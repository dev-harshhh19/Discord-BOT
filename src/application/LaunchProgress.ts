import { TextChannel } from 'discord.js';
import { LaunchPhase, QueueInfo } from '../types';
import { logger } from '../infrastructure/logger/WinstonLogger';
import { buildLaunchProgressEmbed } from '../presentation/components/embeds';

/** Phases after which the launch watch is over and the reporter goes quiet. */
const TERMINAL_PHASES: ReadonlySet<LaunchPhase> = new Set(['online', 'failed', 'stopped']);

/**
 * Owns the single "launch progress" message in the control channel.
 *
 * One message is sent when the launch begins and edited in place as the launch
 * moves through its phases, so a start never produces a stream of separate
 * notifications. Edits are deduplicated on a render key (phase + queue
 * position), which keeps the message from flickering when consecutive polls
 * observe the same state.
 */
export class LaunchProgressReporter {
  private readonly getChannel: () => Promise<TextChannel | null>;

  private messageId: string | null = null;
  /** Render key of the last successful send/edit; edits with the same key are skipped. */
  private lastRenderKey: string | null = null;
  private finished = false;
  /** Serialises renders so two overlapping reports cannot both create a message. */
  private renderChain: Promise<void> = Promise.resolve();

  constructor(getChannel: () => Promise<TextChannel | null>) {
    this.getChannel = getChannel;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  /**
   * Renders `phase` into the progress message, creating it on first call.
   * A no-op when the phase and queue position have not changed, and after a
   * terminal phase has been rendered. Concurrent calls are queued, not raced —
   * without that, the eager "booting" render and the first poll's render could
   * both pass the dedup check and each send a message.
   */
  report(phase: LaunchPhase, queueInfo: QueueInfo | null = null): Promise<void> {
    this.renderChain = this.renderChain.then(() => this.render(phase, queueInfo));
    return this.renderChain;
  }

  private async render(phase: LaunchPhase, queueInfo: QueueInfo | null): Promise<void> {
    if (this.finished) return;

    const renderKey = `${phase}|${queueInfo?.position ?? ''}`;
    if (renderKey === this.lastRenderKey) return;

    const channel = await this.getChannel();
    if (!channel) return;

    const embed = buildLaunchProgressEmbed(phase, queueInfo);

    try {
      if (this.messageId !== null) {
        const message = await channel.messages.fetch(this.messageId);
        await message.edit({ embeds: [embed] });
      } else {
        const message = await channel.send({ embeds: [embed] });
        this.messageId = message.id;
      }
      this.lastRenderKey = renderKey;
      logger.debug(`Launch progress rendered: ${phase}.`);
    } catch (err) {
      // 10008 = Unknown Message: someone deleted the progress message. Recreate
      // it on the next phase change rather than failing every edit.
      if (String(err).includes('10008')) {
        this.messageId = null;
        logger.warn('The launch progress message was deleted; it will be recreated.');
        return;
      }
      logger.warn(`Failed to render launch progress "${phase}": ${String(err)}`);
      return;
    }

    if (TERMINAL_PHASES.has(phase)) {
      this.finished = true;
    }
  }
}
