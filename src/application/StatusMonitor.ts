import { Client, TextChannel } from 'discord.js';
import { ServiceContainer, ServerState, MinecraftStatus, QueueInfo } from '../types';
import { config } from '../config/env';
import { logger } from '../infrastructure/logger/WinstonLogger';
import { buildDashboardEmbed, buildNotificationEmbed } from '../presentation/components/embeds';
import { buildDashboardButtons } from '../presentation/components/buttons';
import { MinecraftQueryError } from '../utils/errors';

const QUEUE_POLL_INTERVAL_MS = 120_000;  // 2 minutes when queueing
const NORMAL_POLL_INTERVAL_MS = config.POLL_INTERVAL_SECONDS * 1000;

export class StatusMonitor {
  private services: ServiceContainer;
  private client: Client;
  private intervalHandle: NodeJS.Timeout | null = null;
  private previousState: ServerState = ServerState.UNKNOWN;
  private isRunning = false;
  private queueStartTime: Date | null = null;
  private queueRestartCount: number = 0;

  constructor(services: ServiceContainer, client: Client) {
    this.services = services;
    this.client = client;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`StatusMonitor starting (default interval: ${NORMAL_POLL_INTERVAL_MS / 1000}s)`);
    this.scheduleNext(NORMAL_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    logger.info('StatusMonitor stopped.');
  }

  forcePoll(): void {
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }
    logger.info('StatusMonitor forcePoll triggered.');
    void this.poll();
  }

  private scheduleNext(ms: number): void {
    this.intervalHandle = setTimeout(() => {
      void this.poll();
    }, ms);
  }

  private async poll(): Promise<void> {
    try {
      await this.doPoll();
    } catch (err) {
      logger.error(`StatusMonitor poll error: ${String(err)}`);
    }

    if (!this.isRunning) return;

    // Adjust interval based on current state
    const nextInterval =
      this.services.currentState === ServerState.QUEUEING
        ? QUEUE_POLL_INTERVAL_MS
        : NORMAL_POLL_INTERVAL_MS;

    this.scheduleNext(nextInterval);
  }

  private async doPoll(): Promise<void> {
    let newState: ServerState;
    let mcStatus: MinecraftStatus | null = null;

    // Step 1: Try direct Minecraft protocol ping
    try {
      mcStatus = await this.services.minecraft.pingServer();
      newState = ServerState.ONLINE;
      this.services.lastMinecraftStatus = mcStatus;

      if (this.services.serverOnlineAt === null) {
        this.services.serverOnlineAt = new Date();
      }

      logger.debug(
        `MC ping OK: ${mcStatus.players.online}/${mcStatus.players.max} players, ${mcStatus.latency}ms`,
      );
    } catch (err) {
      if (err instanceof MinecraftQueryError && err.message.includes('awaiting threshold')) {
        // Below failure threshold — keep current state, don't downgrade
        logger.debug('MC ping below failure threshold, keeping current state.');
        return;
      }

      // Step 2: Fall back to Aternos panel scrape
      logger.debug('MC ping failed. Falling back to Aternos panel scrape...');
      try {
        newState = await this.services.aternos.getPanelStatus();
        logger.debug(`Aternos panel state: ${newState}`);

        // If server was online before but panel now says offline/crashed, clear uptime
        if (
          (newState === ServerState.OFFLINE || newState === ServerState.CRASHED) &&
          this.services.serverOnlineAt !== null
        ) {
          this.services.serverOnlineAt = null;
        }
      } catch (aternosErr) {
        logger.error(`Aternos panel scrape also failed: ${String(aternosErr)}`);
        newState = ServerState.UNKNOWN;
      }
    }

    let queueInfo = null;

    // Handle QUEUEING state
    if (newState === ServerState.QUEUEING) {
      if (!this.queueStartTime) {
        this.queueStartTime = new Date();
      }
      
      const timeInQueueMs = Date.now() - this.queueStartTime.getTime();
      const tenMins = 10 * 60 * 1000;

      if (timeInQueueMs > tenMins) {
        if (this.queueRestartCount < 2) {
          logger.warn(`Queue stuck > 10m (Restart ${this.queueRestartCount + 1}/2). Triggering restart cycle...`);
          try {
            await this.services.aternos.stopServer();
            // Wait 5 seconds for Aternos to process stop
            await new Promise(res => setTimeout(res, 5000));
            await this.services.aternos.startServer();
            this.queueRestartCount++;
            this.queueStartTime = new Date();
            // Server should go to STARTING or QUEUEING again soon
          } catch (e) {
            logger.error(`Queue restart fallback failed: ${String(e)}`);
          }
        } else {
          logger.warn('Queue restart limit (3) reached. Waiting normally.');
        }
      }

      queueInfo = await this.services.aternos.getQueueInfo();

      logger.debug('Server in queue — attempting auto-confirmation...');
      try {
        const confirmed = await this.services.aternos.confirmQueue();
        if (confirmed) {
          logger.info('Queue auto-confirmed! Sending Discord notification.');
          await this.sendNotification('queue_confirmed');
          newState = ServerState.STARTING;
        }
      } catch (err) {
        logger.warn(`Queue confirmation attempt failed: ${String(err)}`);
      }
    } else {
      // Reset queue tracking if not in queue
      this.queueStartTime = null;
      this.queueRestartCount = 0;
    }

    // State transition detection and notifications
    await this.handleStateTransition(newState, mcStatus);
    this.services.currentState = newState;

    // Update the dashboard
    await this.updateDashboard(mcStatus, queueInfo);
  }

  private async handleStateTransition(
    newState: ServerState,
    _mcStatus: MinecraftStatus | null,
  ): Promise<void> {
    const prev = this.previousState;

    if (newState === prev) return;

    logger.info(`State transition: ${prev} -> ${newState}`);

    switch (newState) {
      case ServerState.ONLINE:
        if (prev !== ServerState.ONLINE) {
          await this.sendNotification('online');
        }
        break;
      case ServerState.OFFLINE:
        if (prev === ServerState.ONLINE || prev === ServerState.STOPPING) {
          await this.sendNotification('offline');
        }
        break;
      case ServerState.CRASHED:
        await this.sendNotification('crashed');
        break;
      case ServerState.QUEUEING:
        if (prev !== ServerState.QUEUEING) {
          await this.sendNotification('queue_started');
        }
        break;
    }

    this.previousState = newState;
  }

  private async updateDashboard(mcStatus: MinecraftStatus | null, queueInfo: QueueInfo | null = null): Promise<void> {
    if (!this.services.dashboardMessageId) return;

    try {
      const channel = await this.client.channels.fetch(config.CONTROL_CHANNEL_ID);
      if (!channel || !(channel instanceof TextChannel)) return;

      const message = await channel.messages.fetch(this.services.dashboardMessageId);
      if (!message) return;

      const isOnline = this.services.currentState === ServerState.ONLINE;

      await message.edit({
        embeds: [
          buildDashboardEmbed(this.services.currentState, mcStatus, this.services.serverOnlineAt, queueInfo),
        ],
        components: [buildDashboardButtons(isOnline)],
      });
    } catch (err) {
      logger.warn(`Failed to update dashboard: ${String(err)}`);
    }
  }

  private async sendNotification(
    event: 'online' | 'offline' | 'crashed' | 'queue_started' | 'queue_confirmed',
  ): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(config.CONTROL_CHANNEL_ID);
      if (!channel || !(channel instanceof TextChannel)) return;

      await channel.send({ embeds: [buildNotificationEmbed(event)] });
      logger.info(`Notification sent: ${event}`);
    } catch (err) {
      logger.warn(`Failed to send notification (${event}): ${String(err)}`);
    }
  }
}
