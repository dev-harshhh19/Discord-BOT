import { Client, TextChannel } from 'discord.js';
import { ServiceContainer, ServerState, MinecraftStatus, QueueInfo } from '../types';
import { config } from '../config/env';
import { logger } from '../infrastructure/logger/WinstonLogger';
import { buildDashboardEmbed, buildNotificationEmbed } from '../presentation/components/embeds';
import { buildDashboardButtons } from '../presentation/components/buttons';
import { MinecraftQueryError, isBelowFailureThreshold } from '../utils/errors';
import { sleep } from '../utils/time';
import { LaunchProgressReporter } from './LaunchProgress';

export type NotificationEvent =
  | 'online'
  | 'offline'
  | 'crashed'
  | 'queue_started'
  | 'queue_confirmed';

/** Tracking for one launch, from the start request until the server is up. */
interface LaunchWatch {
  reporter: LaunchProgressReporter;
  startedAt: Date;
  /** Set once the launch has visibly progressed (starting or queueing seen). */
  sawProgress: boolean;
}

/**
 * Background polling engine.
 *
 * Determines server state from two independent sources — a direct Minecraft
 * protocol ping (authoritative when it succeeds) and a scrape of the Aternos
 * panel (the fallback) — then drives the pinned dashboard and state-change
 * notifications.
 *
 * Scheduling uses a self-rescheduling `setTimeout` rather than `setInterval`, so
 * a slow poll can never overlap the next one. A re-entrancy guard protects the
 * same invariant against `forcePoll()`.
 */
export class StatusMonitor {
  private readonly services: ServiceContainer;
  private readonly client: Client;

  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  /** Guards against two poll chains existing at once. */
  private pollInFlight = false;
  /** Set when a poll is requested while one is already running. */
  private pollRequested = false;

  private previousState: ServerState = ServerState.UNKNOWN;
  private queueStartedAt: Date | null = null;
  private queueRestartCount = 0;
  private consecutiveAternosFailures = 0;

  /** Non-null while a launch is being watched at the fast poll interval. */
  private launch: LaunchWatch | null = null;

  constructor(services: ServiceContainer, client: Client) {
    this.services = services;
    this.client = client;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(
      `StatusMonitor started (poll every ${config.polling.normalIntervalMs / 1000}s, ` +
        `${config.polling.launchIntervalMs / 1000}s during a launch).`,
    );
    this.scheduleNext(0);
  }

  stop(): void {
    this.isRunning = false;
    this.clearTimer();
    logger.info('StatusMonitor stopped.');
  }

  /**
   * Starts (or restarts) a launch watch: polling drops to the fast launch
   * interval and a single progress message tracks the launch through
   * booting → queue → auto-confirm → online, edited in place.
   *
   * Called from every code path that requests a server start. Idempotent while
   * a watch is already active, so repeated `/start` clicks cannot spawn a
   * second progress message.
   */
  beginLaunchWatch(): void {
    if (!this.isRunning) return;

    if (this.launch !== null && !this.launch.reporter.isFinished) {
      logger.debug('A launch watch is already active; not starting another.');
      this.forcePoll();
      return;
    }

    this.launch = {
      reporter: new LaunchProgressReporter(() => this.getControlChannel()),
      startedAt: new Date(),
      sawProgress: false,
    };
    logger.info(
      `Launch watch started (polling every ${config.polling.launchIntervalMs / 1000}s ` +
        'until the server is online).',
    );

    // Show "booting" at once rather than waiting for the first poll.
    void this.launch.reporter.report('booting');
    this.forcePoll();
  }

  /**
   * Requests an immediate poll.
   *
   * Previously this cleared the pending timer and called `poll()` directly. If a
   * poll was already running, the running one also rescheduled on completion —
   * leaving two independent timer chains, and one more with every `/start`.
   * Now a poll already in flight simply sets a flag and is re-run once.
   */
  forcePoll(): void {
    if (!this.isRunning) return;

    if (this.pollInFlight) {
      this.pollRequested = true;
      logger.debug('forcePoll requested while a poll is running; queued one re-run.');
      return;
    }

    this.clearTimer();
    logger.debug('forcePoll triggered.');
    void this.runPollCycle();
  }

  /**
   * Clears all cached state, reloads the Aternos panel, and forces an immediate fresh poll
   * that updates the dashboard and all bot internal state immediately.
   */
  async forceRefresh(): Promise<{ state: ServerState; mcStatus: MinecraftStatus | null }> {
    logger.info('Performing full force refresh (clearing all cache, reloading panel)...');

    // Clear debounce & failure trackers
    this.services.minecraft.reset?.();
    this.consecutiveAternosFailures = 0;

    // Reload panel DOM if available
    if (this.services.aternos.reloadPanel) {
      try {
        await this.services.aternos.reloadPanel();
      } catch (err) {
        logger.warn(`Could not reload panel during forceRefresh: ${String(err)}`);
      }
    }

    const { state, mcStatus } = await this.determineState(true);

    let queueInfo: QueueInfo | null = null;
    let effectiveState = state;

    if (state === ServerState.QUEUEING) {
      queueInfo = await this.handleQueue();
      if (queueInfo === null && this.services.currentState === ServerState.STARTING) {
        effectiveState = ServerState.STARTING;
      }
    } else {
      this.resetQueueTracking();
    }

    await this.handleStateTransition(effectiveState);
    this.services.currentState = effectiveState;

    await this.updateLaunchWatch(effectiveState, queueInfo);
    await this.updateDashboard(mcStatus, queueInfo);

    logger.info(`Force refresh completed. Current state: ${effectiveState}`);
    return { state: effectiveState, mcStatus };
  }

  // ─── Scheduling ─────────────────────────────────────────────────────────────

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(ms: number): void {
    this.clearTimer();
    if (!this.isRunning) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runPollCycle();
    }, ms);
  }

  private async runPollCycle(): Promise<void> {
    if (this.pollInFlight) {
      this.pollRequested = true;
      return;
    }
    this.pollInFlight = true;

    try {
      do {
        this.pollRequested = false;
        try {
          await this.poll();
        } catch (err) {
          logger.error(`StatusMonitor poll failed: ${String(err)}`);
        }
      } while (this.pollRequested && this.isRunning);
    } finally {
      this.pollInFlight = false;
    }

    if (!this.isRunning) return;

    this.scheduleNext(this.nextInterval());
  }

  /**
   * Chooses the delay before the next poll.
   *
   * An active launch watch polls at the fast launch interval so the transition
   * to online is caught within seconds. The moment the watch ends — online,
   * failed, or timed out — the schedule falls back to the slower steady-state
   * intervals, so the fast rate can never leak into normal operation.
   */
  private nextInterval(): number {
    if (this.launch !== null && !this.launch.reporter.isFinished) {
      return config.polling.launchIntervalMs;
    }

    return this.services.currentState === ServerState.QUEUEING
      ? config.polling.queueIntervalMs
      : config.polling.normalIntervalMs;
  }

  // ─── Poll body ──────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    const { state, mcStatus } = await this.determineState();

    let queueInfo: QueueInfo | null = null;
    let effectiveState = state;

    if (state === ServerState.QUEUEING) {
      queueInfo = await this.handleQueue();
      if (queueInfo === null && this.services.currentState === ServerState.STARTING) {
        // handleQueue confirmed the queue and moved us forward.
        effectiveState = ServerState.STARTING;
      }
    } else {
      this.resetQueueTracking();
    }

    await this.handleStateTransition(effectiveState);
    this.services.currentState = effectiveState;

    await this.updateLaunchWatch(effectiveState, queueInfo);

    // The dashboard is refreshed on every cycle, including cycles where the
    // state did not change, so uptime and player counts stay live.
    await this.updateDashboard(mcStatus, queueInfo);
  }

  // ─── Launch watch ───────────────────────────────────────────────────────────

  /**
   * Advances the launch progress message and decides when the watch ends.
   *
   * The reporter deduplicates renders, so calling this on every fast poll is
   * safe — the Discord message is only edited when the phase or queue position
   * actually changes. Terminal phases mark the reporter finished, which flips
   * `nextInterval()` back to the slow schedule on the same cycle.
   */
  private async updateLaunchWatch(state: ServerState, queueInfo: QueueInfo | null): Promise<void> {
    const launch = this.launch;
    if (launch === null || launch.reporter.isFinished) return;

    switch (state) {
      case ServerState.ONLINE:
        await launch.reporter.report('online');
        this.launch = null;
        logger.info('Launch watch finished: the server is online.');
        return;

      case ServerState.STARTING:
        launch.sawProgress = true;
        await launch.reporter.report('booting');
        break;

      case ServerState.QUEUEING:
        launch.sawProgress = true;
        await launch.reporter.report('queueing', queueInfo);
        break;

      case ServerState.CRASHED:
        await launch.reporter.report('failed');
        this.launch = null;
        logger.warn('Launch watch finished: the server crashed during startup.');
        return;

      case ServerState.OFFLINE:
        if (launch.sawProgress) {
          await launch.reporter.report('failed');
          this.launch = null;
          logger.warn('Launch watch finished: the server went back offline.');
          return;
        }
        break;

      default:
        break;
    }

    const watchedMs = Date.now() - launch.startedAt.getTime();
    if (watchedMs > config.polling.launchTimeoutMs) {
      await launch.reporter.report('stopped');
      this.launch = null;
      logger.warn(
        `Launch watch abandoned after ${Math.round(watchedMs / 60_000)} minutes ` +
          'without the server coming online.',
      );
    }
  }

  /** Renders the auto-confirm phase the moment a queue slot is being claimed. */
  private async reportLaunchConfirming(): Promise<void> {
    if (this.launch !== null && !this.launch.reporter.isFinished) {
      await this.launch.reporter.report('confirming');
    }
  }

  /**
   * Resolves the current state.
   *
   * A direct protocol ping is authoritative: if the server answers, it is up.
   * Only when the ping fails (and has failed enough times to clear the
   * debounce threshold) do we pay the cost of scraping the Aternos panel.
   */
  private async determineState(bypassDebounce = false): Promise<{
    state: ServerState;
    mcStatus: MinecraftStatus | null;
  }> {
    try {
      const mcStatus = await this.services.minecraft.pingServer();
      this.services.lastMinecraftStatus = mcStatus;
      this.services.serverOnlineAt ??= new Date();
      this.consecutiveAternosFailures = 0;
      return { state: ServerState.ONLINE, mcStatus };
    } catch (err) {
      // Below the debounce threshold: a single dropped packet must not flip the
      // dashboard to offline if the server was already stably online and not launching.
      if (
        !bypassDebounce &&
        isBelowFailureThreshold(err) &&
        this.services.currentState === ServerState.ONLINE &&
        this.launch === null
      ) {
        logger.debug('Minecraft ping failed but is below the failure threshold; holding state.');
        return {
          state: this.services.currentState,
          mcStatus: this.services.lastMinecraftStatus,
        };
      }

      if (!(err instanceof MinecraftQueryError)) {
        logger.warn(`Unexpected Minecraft ping error: ${String(err)}`);
      }
    }

    // Fall back to the Aternos panel.
    try {
      const state = await this.services.aternos.getPanelStatus();
      this.consecutiveAternosFailures = 0;

      if (state === ServerState.ONLINE) {
        this.services.serverOnlineAt ??= new Date();
      } else {
        this.services.serverOnlineAt = null;
        this.services.lastMinecraftStatus = null;
      }
      return { state, mcStatus: null };
    } catch (err) {
      this.consecutiveAternosFailures++;
      logger.error(
        `Aternos panel scrape failed ` +
          `(${this.consecutiveAternosFailures} consecutive): ${String(err)}`,
      );

      // If launch watch is active and panel scrape failed, hold STARTING/QUEUEING
      if (
        !bypassDebounce &&
        this.launch !== null &&
        (this.services.currentState === ServerState.STARTING ||
          this.services.currentState === ServerState.QUEUEING)
      ) {
        return { state: this.services.currentState, mcStatus: null };
      }

      // Both sources are down. Report UNKNOWN rather than guessing OFFLINE —
      // handleStateTransition deliberately stays silent on UNKNOWN so an
      // outage of our own monitoring does not page the Discord channel.
      return { state: ServerState.UNKNOWN, mcStatus: null };
    }
  }

  // ─── Queue handling ─────────────────────────────────────────────────────────

  /**
   * Manages the Aternos queue: reports position, auto-confirms when the slot is
   * offered, and force-re-queues if the position stops advancing.
   *
   * Returns the queue info to render, or `null` if the queue was confirmed and
   * the server has moved on to starting.
   */
  private async handleQueue(): Promise<QueueInfo | null> {
    this.queueStartedAt ??= new Date();

    const waitedMs = Date.now() - this.queueStartedAt.getTime();
    if (waitedMs > config.polling.queueStuckMs) {
      await this.forceRequeue();
    }

    const queueInfo = await this.services.aternos.getQueueInfo().catch((err: unknown) => {
      logger.debug(`Could not read queue info: ${String(err)}`);
      return null;
    });

    try {
      const confirmed = await this.services.aternos.confirmQueue();
      if (confirmed) {
        logger.info('Queue slot confirmed automatically.');
        await this.reportLaunchConfirming();
        this.resetQueueTracking();
        await this.sendNotification('queue_confirmed');
        this.services.currentState = ServerState.STARTING;
        return null;
      }
    } catch (err) {
      logger.warn(`Queue confirmation attempt failed: ${String(err)}`);
    }

    return queueInfo;
  }

  /** Stops and restarts the server when the queue has stalled. */
  private async forceRequeue(): Promise<void> {
    if (this.queueRestartCount >= config.polling.maxQueueRestarts) {
      logger.warn(
        `Queue has stalled but the restart limit (${config.polling.maxQueueRestarts}) is ` +
          'reached; waiting it out.',
      );
      return;
    }

    const attempt = this.queueRestartCount + 1;
    logger.warn(
      `Queue stalled for over ${config.polling.queueStuckMs / 60_000} minutes; ` +
        `re-queueing (attempt ${attempt}/${config.polling.maxQueueRestarts}).`,
    );

    try {
      await this.services.aternos.stopServer();
      await sleep(5_000);
      await this.services.aternos.startServer();
      this.queueRestartCount = attempt;
      this.queueStartedAt = new Date();
    } catch (err) {
      logger.error(`Re-queue attempt failed: ${String(err)}`);
    }
  }

  private resetQueueTracking(): void {
    this.queueStartedAt = null;
    this.queueRestartCount = 0;
  }

  // ─── Transitions ────────────────────────────────────────────────────────────

  /**
   * Announces meaningful state changes.
   *
   * UNKNOWN is treated as "no information", not as a state: it neither fires a
   * notification nor becomes the new baseline. Without that, a transient scrape
   * failure produced ONLINE → UNKNOWN → ONLINE and re-announced "Server Online"
   * on every blip.
   */
  private async handleStateTransition(newState: ServerState): Promise<void> {
    if (newState === ServerState.UNKNOWN) return;

    const previous = this.previousState;
    if (newState === previous) return;

    logger.info(`State transition: ${previous} -> ${newState}`);
    this.previousState = newState;

    switch (newState) {
      case ServerState.ONLINE:
        await this.sendNotification('online');
        break;

      case ServerState.OFFLINE:
        // Only announce a shutdown we actually observed running.
        if (previous === ServerState.ONLINE || previous === ServerState.STOPPING) {
          await this.sendNotification('offline');
        }
        break;

      case ServerState.CRASHED:
        await this.sendNotification('crashed');
        break;

      case ServerState.QUEUEING:
        await this.sendNotification('queue_started');
        break;

      default:
        break;
    }
  }

  // ─── Discord output ─────────────────────────────────────────────────────────

  private async getControlChannel(): Promise<TextChannel | null> {
    try {
      const channel = await this.client.channels.fetch(config.discord.controlChannelId);
      if (channel instanceof TextChannel) return channel;
      logger.warn(
        `CONTROL_CHANNEL_ID ${config.discord.controlChannelId} is not a text channel the bot can use.`,
      );
      return null;
    } catch (err) {
      logger.warn(`Could not fetch the control channel: ${String(err)}`);
      return null;
    }
  }

  private async updateDashboard(
    mcStatus: MinecraftStatus | null,
    queueInfo: QueueInfo | null,
  ): Promise<void> {
    if (!this.services.dashboardMessageId) return;

    const channel = await this.getControlChannel();
    if (!channel) return;

    try {
      const message = await channel.messages.fetch(this.services.dashboardMessageId);
      await message.edit({
        embeds: [
          buildDashboardEmbed(
            this.services.currentState,
            mcStatus ?? this.services.lastMinecraftStatus,
            this.services.serverOnlineAt,
            queueInfo,
          ),
        ],
        components: [buildDashboardButtons(this.services.currentState)],
      });
    } catch (err) {
      // 10008 = Unknown Message: the dashboard was deleted. Drop the reference
      // so it is recreated on the next restart instead of erroring every cycle.
      if (String(err).includes('10008')) {
        logger.warn('The dashboard message no longer exists; clearing its reference.');
        this.services.dashboardMessageId = null;
        return;
      }
      logger.warn(`Failed to update the dashboard: ${String(err)}`);
    }
  }

  private async sendNotification(event: NotificationEvent): Promise<void> {
    // While a launch watch is active its single progress message already covers
    // the launch lifecycle; a second standalone embed for the same event would
    // be exactly the notification spam the watch exists to prevent.
    if (
      this.launch !== null &&
      !this.launch.reporter.isFinished &&
      (event === 'online' || event === 'queue_started' || event === 'queue_confirmed')
    ) {
      logger.debug(`Notification "${event}" suppressed: the launch progress message covers it.`);
      return;
    }

    const channel = await this.getControlChannel();
    if (!channel) return;

    try {
      await channel.send({ embeds: [buildNotificationEmbed(event)] });
      logger.info(`Notification sent: ${event}`);
    } catch (err) {
      logger.warn(`Failed to send the "${event}" notification: ${String(err)}`);
    }
  }
}
