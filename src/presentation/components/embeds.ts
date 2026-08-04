import { EmbedBuilder } from 'discord.js';
import {
  ServerState,
  MinecraftStatus,
  PermissionLevel,
  EMBED_COLORS,
  QueueInfo,
  LaunchPhase,
} from '../../types';
import { formatTimestamp, formatUptime } from '../../utils/time';
import { permissionLevelName } from '../../utils/permissions';
import { config } from '../../config/env';

/**
 * Embed construction.
 *
 * Every piece of server identity — name, address, version, hardware, region —
 * comes from configuration rather than a literal, so the bot can be pointed at
 * a different server without editing source. Where live data is available (from
 * a successful protocol ping) it takes precedence over the configured value.
 */

const NAME = (): string => config.branding.serverName;
const ADDRESS = (): string => `\`${config.minecraft.address}:${config.minecraft.port}\``;

function footer(prefix?: string): { text: string } {
  const stamp = formatTimestamp();
  return { text: prefix ? `${prefix} ${stamp}` : stamp };
}

/** Title-cased, human-readable label for a state. */
const STATE_LABEL: Record<ServerState, string> = {
  [ServerState.ONLINE]: 'Online',
  [ServerState.OFFLINE]: 'Offline',
  [ServerState.STARTING]: 'Starting',
  [ServerState.QUEUEING]: 'In Queue',
  [ServerState.STOPPING]: 'Stopping',
  [ServerState.CRASHED]: 'Crashed',
  [ServerState.UNKNOWN]: 'Unknown',
};

const STATE_COLOR: Record<ServerState, number> = {
  [ServerState.ONLINE]: EMBED_COLORS.ONLINE,
  [ServerState.OFFLINE]: EMBED_COLORS.OFFLINE,
  [ServerState.STARTING]: EMBED_COLORS.STARTING,
  [ServerState.QUEUEING]: EMBED_COLORS.QUEUEING,
  [ServerState.STOPPING]: EMBED_COLORS.OFFLINE,
  [ServerState.CRASHED]: EMBED_COLORS.ERROR,
  [ServerState.UNKNOWN]: EMBED_COLORS.WARNING,
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function buildDashboardEmbed(
  state: ServerState,
  mcStatus: MinecraftStatus | null,
  serverOnlineAt: Date | null,
  queueInfo: QueueInfo | null = null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${NAME()} — Server Dashboard`)
    .setColor(STATE_COLOR[state])
    .setFooter(footer('Last updated:'));

  switch (state) {
    case ServerState.ONLINE:
      embed.addFields(
        { name: 'Status', value: STATE_LABEL[state], inline: true },
        {
          name: 'Players',
          value: mcStatus ? `${mcStatus.players.online}/${mcStatus.players.max}` : 'N/A',
          inline: true,
        },
        { name: 'Latency', value: mcStatus ? `${mcStatus.latency}ms` : 'N/A', inline: true },
        { name: 'Address', value: ADDRESS(), inline: true },
        { name: 'Version', value: displayVersion(mcStatus), inline: true },
        {
          name: 'Uptime',
          value: serverOnlineAt ? formatUptime(serverOnlineAt) : 'N/A',
          inline: true,
        },
      );
      break;

    case ServerState.STARTING:
      embed
        .addFields(
          { name: 'Status', value: STATE_LABEL[state], inline: true },
          { name: 'Address', value: ADDRESS(), inline: true },
        )
        .setDescription('The server is starting. This usually takes a minute or two.');
      break;

    case ServerState.QUEUEING: {
      const restarts = config.polling.maxQueueRestarts;
      const stuckMinutes = config.polling.queueStuckMs / 60_000;
      embed
        .addFields(
          { name: 'Status', value: STATE_LABEL[state], inline: true },
          { name: 'Position', value: queueInfo?.position || 'N/A', inline: true },
          { name: 'Est. Time', value: queueInfo?.estimatedTime || 'N/A', inline: true },
        )
        .setDescription(
          'Waiting in the Aternos queue. The slot will be confirmed automatically.\n' +
          (restarts > 0
            ? `*If the queue stalls for over ${stuckMinutes} minutes, the bot re-queues ` +
            `up to ${restarts} time${restarts === 1 ? '' : 's'}.*`
            : '*Automatic re-queueing is disabled.*'),
        );
      break;
    }

    case ServerState.STOPPING:
      embed
        .addFields({ name: 'Status', value: STATE_LABEL[state], inline: true })
        .setDescription('The server is shutting down and saving the world.');
      break;

    case ServerState.CRASHED:
      embed
        .addFields({ name: 'Status', value: STATE_LABEL[state], inline: true })
        .setDescription('The server crashed. Starting it again may be enough to recover.');
      break;

    case ServerState.UNKNOWN:
      embed
        .addFields({ name: 'Status', value: STATE_LABEL[state], inline: true })
        .setDescription(
          'The server state could not be determined. Both the direct ping and the ' +
          'Aternos panel are unreachable — this usually clears on its own.',
        );
      break;

    case ServerState.OFFLINE:
    default:
      embed
        .addFields(
          { name: 'Status', value: STATE_LABEL[ServerState.OFFLINE], inline: true },
          { name: 'Address', value: ADDRESS(), inline: true },
        )
        .setDescription('The server is offline. Use the Start button or `/start` to launch it.');
      break;
  }

  return embed;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function buildStatusEmbed(
  state: ServerState,
  mcStatus: MinecraftStatus | null,
  serverOnlineAt: Date | null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${NAME()} — Status`)
    .setColor(STATE_COLOR[state])
    .setFooter(footer('Queried at:'))
    .addFields({ name: 'State', value: STATE_LABEL[state], inline: true });

  if (state === ServerState.ONLINE && mcStatus) {
    embed.addFields(
      {
        name: 'Players',
        value: `${mcStatus.players.online}/${mcStatus.players.max}`,
        inline: true,
      },
      {
        name: 'Uptime',
        value: serverOnlineAt ? formatUptime(serverOnlineAt) : 'N/A',
        inline: true,
      },
      { name: 'Address', value: ADDRESS(), inline: true },
    );
  }

  return embed;
}

// ─── Players ──────────────────────────────────────────────────────────────────

/** Discord truncates embed field values above 1024 characters. */
const MAX_FIELD_LENGTH = 1024;

export function buildPlayersEmbed(mcStatus: MinecraftStatus): EmbedBuilder {
  const { online, max, list } = mcStatus.players;

  let value: string;
  if (list.length === 0) {
    // Aternos and most servers only sample a subset of names; an empty sample
    // with a non-zero count is normal, not an error.
    value =
      online > 0
        ? `${online} player${online === 1 ? '' : 's'} online, but the server did not share names.`
        : 'No players are currently online.';
  } else {
    value = truncateList(list.map((p) => `- ${p.name}`));
  }

  return new EmbedBuilder()
    .setTitle(`${NAME()} — Players`)
    .setColor(EMBED_COLORS.ONLINE)
    .setFooter(footer('Queried at:'))
    .addFields({ name: `Online (${online}/${max})`, value });
}

function truncateList(lines: string[]): string {
  const joined = lines.join('\n');
  if (joined.length <= MAX_FIELD_LENGTH) return joined;

  const kept: string[] = [];
  let length = 0;
  const suffix = '\n…and more';

  for (const line of lines) {
    if (length + line.length + 1 + suffix.length > MAX_FIELD_LENGTH) break;
    kept.push(line);
    length += line.length + 1;
  }
  return `${kept.join('\n')}${suffix}`;
}

// ─── Info ─────────────────────────────────────────────────────────────────────

function displayVersion(mcStatus: MinecraftStatus | null): string {
  if (mcStatus?.version && mcStatus.version !== 'Unknown') return mcStatus.version;
  return config.minecraft.version;
}

export function buildInfoEmbed(mcStatus: MinecraftStatus | null = null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${NAME()} — Server Information`)
    .setColor(EMBED_COLORS.INFO)
    .addFields(
      { name: 'Address', value: `\`${config.minecraft.address}\``, inline: true },
      { name: 'Port', value: `\`${config.minecraft.port}\``, inline: true },
      { name: 'Version', value: displayVersion(mcStatus), inline: true },
      { name: 'Software', value: mcStatus?.software ?? config.minecraft.software, inline: true },
      { name: 'Memory', value: config.minecraft.ram, inline: true },
      { name: 'Region', value: config.minecraft.region, inline: true },
    );

  if (config.branding.footer !== '') {
    embed.setFooter({ text: config.branding.footer });
  }

  return embed;
}

// ─── Help ─────────────────────────────────────────────────────────────────────

export function buildHelpEmbed(permLevel: PermissionLevel): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Available Commands')
    .setColor(EMBED_COLORS.INFO)
    .setDescription(`Your access level: **${permissionLevelName(permLevel)}**`)
    .setFooter(footer());

  embed.addFields({
    name: 'Everyone',
    value: [
      '`/status` — current server state',
      '`/info` — connection details',
      '`/help` — this message',
      ...(config.registration.enabled && permLevel < PermissionLevel.TRUSTED
        ? ['`/register` — register yourself for Trusted access']
        : []),
    ].join('\n'),
  });

  if (permLevel >= PermissionLevel.TRUSTED) {
    embed.addFields({
      name: 'Trusted Members',
      value: [
        '`/start` — start the server',
        '`/players` — who is online',
        '`/ping` — measure latency',
      ].join('\n'),
    });
  }

  if (permLevel >= PermissionLevel.ADMIN) {
    embed.addFields({
      name: 'Administrators',
      value: '`/stop` — stop the server (requires confirmation)',
    });
  }

  if (permLevel >= PermissionLevel.OWNER) {
    embed.addFields({
      name: 'Owner',
      value: [
        '`/restart` — restart the server via direct AJAX / sequence',
        '`/force-refresh` — clear cache, reload panel & refresh all bot states',
      ].join('\n'),
    });
  }

  return embed;
}

// ─── Latency ──────────────────────────────────────────────────────────────────

export function buildPingEmbed(wsLatencyMs: number, mcLatencyMs: number | null): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Network Latency')
    .setColor(EMBED_COLORS.INFO)
    .addFields(
      {
        name: 'Discord Gateway',
        // discord.js reports -1 before the first heartbeat completes.
        value: wsLatencyMs >= 0 ? `${Math.round(wsLatencyMs)}ms` : 'Measuring…',
        inline: true,
      },
      {
        name: 'Minecraft Server',
        value: mcLatencyMs !== null ? `${mcLatencyMs}ms` : 'Unreachable',
        inline: true,
      },
    )
    .setFooter(footer('Measured at:'));
}

// ─── Action and confirmation embeds ───────────────────────────────────────────

export function buildStopConfirmEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Confirm Server Stop')
    .setColor(EMBED_COLORS.WARNING)
    .setDescription(
      `Stop **${NAME()}**? Players will be disconnected and any unsaved progress ` +
      'from the last few seconds may be lost.',
    );
}

export function buildStartingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Starting Server')
    .setColor(EMBED_COLORS.STARTING)
    .setDescription(
      'The start request has been sent to Aternos. If the queue is busy the bot will ' +
      'confirm the slot automatically — the dashboard updates as it progresses.',
    )
    .setFooter(footer());
}

export function buildStoppingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Stopping Server')
    .setColor(EMBED_COLORS.OFFLINE)
    .setDescription('The stop request has been sent to Aternos.')
    .setFooter(footer());
}

export function buildRestartProgressEmbed(phase: 'stopping' | 'starting'): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Restarting Server')
    .setColor(EMBED_COLORS.STARTING)
    .setDescription(
      phase === 'stopping'
        ? 'Phase 1 of 2: stopping the server…'
        : 'Phase 2 of 2: starting the server… the dashboard will update when it is online.',
    )
    .setFooter(footer());
}

// ─── Launch progress ──────────────────────────────────────────────────────────

function getProgressBar(phase: LaunchPhase): string {
  switch (phase) {
    case 'booting': return '`[##--------]` 20%';
    case 'queueing': return '`[#####-----]` 50%';
    case 'confirming': return '`[########--]` 80%';
    case 'online': return '`[##########]` 100%';
    case 'failed':
    case 'stopped': return '`[----------]` Failed';
    default: return '`[----------]`';
  }
}

/**
 * The single message that tracks a launch from the start request to the moment
 * the server is reachable. It is edited in place by `LaunchProgressReporter`,
 * so each phase replaces the previous one instead of stacking notifications.
 */
export function buildLaunchProgressEmbed(
  phase: LaunchPhase,
  queueInfo: QueueInfo | null = null,
): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(`${NAME()} — Launch`).setFooter(footer());
  const bar = getProgressBar(phase);

  switch (phase) {
    case 'booting':
      embed
        .setColor(EMBED_COLORS.STARTING)
        .setDescription(`Server booting… the start request has been sent to Aternos.\n\n${bar}`);
      break;

    case 'queueing':
      embed
        .setColor(EMBED_COLORS.QUEUEING)
        .setDescription(`Waiting in the Aternos queue…\n\n${bar}`)
        .addFields(
          { name: 'Position', value: queueInfo?.position || 'N/A', inline: true },
          { name: 'Est. Time', value: queueInfo?.estimatedTime || 'N/A', inline: true },
        );
      break;

    case 'confirming':
      embed
        .setColor(EMBED_COLORS.STARTING)
        .setDescription(`Queue slot offered — confirming automatically…\n\n${bar}`);
      break;

    case 'online':
      embed
        .setColor(EMBED_COLORS.ONLINE)
        .setDescription(` Server is online. Connect at ${ADDRESS()}.\n\n${bar}`);
      break;

    case 'failed':
      embed
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(`The launch failed. Check the dashboard and try \`/start\` again.\n\n${bar}`);
      break;

    case 'stopped':
      embed
        .setColor(EMBED_COLORS.WARNING)
        .setDescription(
          `Monitoring stopped — the server did not come online in time. ` +
          `The regular dashboard keeps updating at its normal pace.\n\n${bar}`,
        );
      break;
  }

  return embed;
}

// ─── Errors and notifications ─────────────────────────────────────────────────

export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Error')
    .setColor(EMBED_COLORS.ERROR)
    .setDescription(message.slice(0, 4000))
    .setFooter(footer());
}

export function buildNotificationEmbed(
  event: 'online' | 'offline' | 'crashed' | 'queue_started' | 'queue_confirmed',
): EmbedBuilder {
  const embed = new EmbedBuilder().setFooter(footer());
  const name = NAME();

  switch (event) {
    case 'online':
      embed
        .setTitle('Server Online')
        .setColor(EMBED_COLORS.ONLINE)
        .setDescription(`**${name}** is online. Connect at ${ADDRESS()}.`);
      break;

    case 'offline':
      embed
        .setTitle('Server Offline')
        .setColor(EMBED_COLORS.OFFLINE)
        .setDescription(`**${name}** has shut down.`);
      break;

    case 'crashed':
      embed
        .setTitle('Server Crashed')
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(`**${name}** stopped unexpectedly. Try starting it again.`);
      break;

    case 'queue_started':
      embed
        .setTitle('Queued')
        .setColor(EMBED_COLORS.QUEUEING)
        .setDescription(
          `**${name}** is waiting in the Aternos queue. The slot will be confirmed automatically.`,
        );
      break;

    case 'queue_confirmed':
      embed
        .setTitle('Queue Confirmed')
        .setColor(EMBED_COLORS.STARTING)
        .setDescription(`The queue slot for **${name}** was confirmed. The server is starting.`);
      break;
  }

  return embed;
}
