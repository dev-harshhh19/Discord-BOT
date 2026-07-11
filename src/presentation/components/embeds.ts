import { EmbedBuilder } from 'discord.js';
import {
  ServerState,
  MinecraftStatus,
  PermissionLevel,
  EMBED_COLORS,
  QueueInfo,
} from '../../types';
import { formatUptime, getISTString } from '../../utils/timeFormat';
import { permissionLevelName } from '../../utils/permissions';
import { config } from '../../config/env';

// ─── Dashboard Embed ──────────────────────────────────────────────────────────

export function buildDashboardEmbed(
  state: ServerState,
  mcStatus: MinecraftStatus | null,
  serverOnlineAt: Date | null,
  queueInfo: QueueInfo | null = null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('TikdiSMP — Server Dashboard')
    .setFooter({ text: `Last updated: ${getISTString()}` });

  switch (state) {
    case ServerState.ONLINE:
      embed.setColor(EMBED_COLORS.ONLINE);
      embed.addFields(
        { name: 'Status', value: 'Online', inline: true },
        { name: 'Players', value: mcStatus ? `${mcStatus.players.online}/${mcStatus.players.max}` : 'N/A', inline: true },
        { name: 'Latency', value: mcStatus ? `${mcStatus.latency}ms` : 'N/A', inline: true },
        { name: 'Address', value: `\`${config.MC_SERVER_ADDRESS}:${config.MC_SERVER_PORT}\``, inline: true },
        { name: 'Version', value: mcStatus?.version ?? '1.21.6+', inline: true },
        { name: 'Uptime', value: serverOnlineAt ? formatUptime(serverOnlineAt) : 'N/A', inline: true },
      );
      break;

    case ServerState.STARTING:
      embed.setColor(EMBED_COLORS.STARTING);
      embed.addFields(
        { name: 'Status', value: 'Starting...', inline: true },
        { name: 'Address', value: `\`${config.MC_SERVER_ADDRESS}:${config.MC_SERVER_PORT}\``, inline: true },
      );
      embed.setDescription('The server is starting. Please wait a moment.');
      break;

    case ServerState.QUEUEING:
      embed.setColor(EMBED_COLORS.QUEUEING);
      embed.addFields(
        { name: 'Status', value: 'In Queue', inline: true },
        { name: 'Position', value: queueInfo?.position || 'N/A', inline: true },
        { name: 'Est. Time', value: queueInfo?.estimatedTime || 'N/A', inline: true }
      );
      embed.setDescription('The server is waiting in the Aternos queue. Auto-confirmation is active.\n*If queue time exceeds 10 minutes, the bot will automatically stop and re-queue up to 3 times.*');
      break;

    case ServerState.STOPPING:
      embed.setColor(EMBED_COLORS.OFFLINE);
      embed.addFields({ name: 'Status', value: 'Stopping...', inline: true });
      embed.setDescription('The server is shutting down gracefully.');
      break;

    case ServerState.CRASHED:
      embed.setColor(EMBED_COLORS.ERROR);
      embed.addFields({ name: 'Status', value: 'Crashed', inline: true });
      embed.setDescription('The server has crashed. Manual intervention may be required.');
      break;

    case ServerState.OFFLINE:
    default:
      embed.setColor(EMBED_COLORS.OFFLINE);
      embed.addFields(
        { name: 'Status', value: 'Offline', inline: true },
        { name: 'Address', value: `\`${config.MC_SERVER_ADDRESS}:${config.MC_SERVER_PORT}\``, inline: true },
      );
      embed.setDescription('The server is currently offline. Use the Start button or /start to launch it.');
      break;
  }

  return embed;
}

// ─── Status Embed ─────────────────────────────────────────────────────────────

export function buildStatusEmbed(
  state: ServerState,
  mcStatus: MinecraftStatus | null,
  serverOnlineAt: Date | null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Server Status')
    .setFooter({ text: `Queried at: ${getISTString()}` });

  const stateLabel: Record<ServerState, string> = {
    [ServerState.ONLINE]: 'Online',
    [ServerState.OFFLINE]: 'Offline',
    [ServerState.STARTING]: 'Starting',
    [ServerState.QUEUEING]: 'In Queue',
    [ServerState.STOPPING]: 'Stopping',
    [ServerState.CRASHED]: 'Crashed',
    [ServerState.UNKNOWN]: 'Unknown',
  };

  const colorMap: Record<ServerState, number> = {
    [ServerState.ONLINE]: EMBED_COLORS.ONLINE,
    [ServerState.OFFLINE]: EMBED_COLORS.OFFLINE,
    [ServerState.STARTING]: EMBED_COLORS.STARTING,
    [ServerState.QUEUEING]: EMBED_COLORS.QUEUEING,
    [ServerState.STOPPING]: EMBED_COLORS.OFFLINE,
    [ServerState.CRASHED]: EMBED_COLORS.ERROR,
    [ServerState.UNKNOWN]: EMBED_COLORS.WARNING,
  };

  embed.setColor(colorMap[state]);
  embed.addFields({ name: 'State', value: stateLabel[state], inline: true });

  if (state === ServerState.ONLINE && mcStatus) {
    embed.addFields(
      { name: 'Players', value: `${mcStatus.players.online}/${mcStatus.players.max}`, inline: true },
      { name: 'Uptime', value: serverOnlineAt ? formatUptime(serverOnlineAt) : 'N/A', inline: true },
    );
  }

  return embed;
}

// ─── Players Embed ────────────────────────────────────────────────────────────

export function buildPlayersEmbed(mcStatus: MinecraftStatus): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Players Online')
    .setColor(EMBED_COLORS.ONLINE)
    .setFooter({ text: `Queried at: ${getISTString()}` });

  embed.addFields({
    name: `Players (${mcStatus.players.online}/${mcStatus.players.max})`,
    value:
      mcStatus.players.list.length > 0
        ? mcStatus.players.list.map((p) => `- ${p.name}`).join('\n')
        : 'No players currently online.',
  });

  return embed;
}

// ─── Info Embed ───────────────────────────────────────────────────────────────

export function buildInfoEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('TikdiSMP — Server Information')
    .setColor(EMBED_COLORS.INFO)
    .addFields(
      { name: 'Address', value: `\`${config.MC_SERVER_ADDRESS}\``, inline: true },
      { name: 'Port', value: `\`${config.MC_SERVER_PORT}\``, inline: true },
      { name: 'Version', value: '1.21.6+', inline: true },
      { name: 'Software', value: 'Paper', inline: true },
      { name: 'RAM', value: '4 GB (Aternos)', inline: true },
      { name: 'Region', value: 'Central Europe (Aternos)', inline: true },
    )
    .setFooter({ text: 'TikdiSMP — Private SMP for the crew' });
}

// ─── Help Embed ───────────────────────────────────────────────────────────────

export function buildHelpEmbed(permLevel: PermissionLevel): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Available Commands')
    .setColor(EMBED_COLORS.INFO)
    .setDescription(`Your access level: **${permissionLevelName(permLevel)}**`)
    .setFooter({ text: getISTString() });

  // Commands available to everyone
  embed.addFields({
    name: 'General',
    value: [
      '`/status` — View the current server state',
      '`/info` — View static server information',
      '`/help` — Show this message',
    ].join('\n'),
  });

  if (permLevel >= PermissionLevel.TRUSTED) {
    embed.addFields({
      name: 'Trusted Members',
      value: [
        '`/start` — Start the Minecraft server',
        '`/players` — View connected players',
        '`/ping` — Measure network latency',
      ].join('\n'),
    });
  }

  if (permLevel >= PermissionLevel.ADMIN) {
    embed.addFields({
      name: 'Administrators',
      value: ['`/stop` — Stop the server (requires confirmation)'].join('\n'),
    });
  }

  if (permLevel >= PermissionLevel.OWNER) {
    embed.addFields({
      name: 'Owner',
      value: ['`/restart` — Restart the server (stop + start)'].join('\n'),
    });
  }

  return embed;
}

// ─── Ping Embed ───────────────────────────────────────────────────────────────

export function buildPingEmbed(wsLatencyMs: number, mcLatencyMs: number | null): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Network Latency')
    .setColor(EMBED_COLORS.INFO)
    .addFields(
      { name: 'Discord WebSocket', value: `${wsLatencyMs}ms`, inline: true },
      { name: 'Minecraft Server', value: mcLatencyMs !== null ? `${mcLatencyMs}ms` : 'Unreachable', inline: true },
    )
    .setFooter({ text: `Measured at: ${getISTString()}` });
}

// ─── Confirmation Embed ───────────────────────────────────────────────────────

export function buildStopConfirmEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Confirm Server Stop')
    .setColor(EMBED_COLORS.WARNING)
    .setDescription(
      'Are you sure you want to stop the server? Any unsaved player progress may be lost.\n\n' +
        'This action will stop the TikdiSMP Aternos server.',
    );
}

// ─── Action Embeds ────────────────────────────────────────────────────────────

export function buildStartingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Starting Server')
    .setColor(EMBED_COLORS.STARTING)
    .setDescription(
      'The start command has been sent to Aternos. The server will be online shortly.\n\n' +
        'The dashboard will update automatically.',
    )
    .setFooter({ text: getISTString() });
}

export function buildStoppingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Stopping Server')
    .setColor(EMBED_COLORS.OFFLINE)
    .setDescription('The stop command has been sent to Aternos. The server is shutting down.')
    .setFooter({ text: getISTString() });
}

export function buildRestartProgressEmbed(phase: 'stopping' | 'starting'): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Restarting Server')
    .setColor(EMBED_COLORS.STARTING)
    .setDescription(
      phase === 'stopping'
        ? 'Phase 1/2: Stopping the server...'
        : 'Phase 2/2: Starting the server... The dashboard will update when online.',
    )
    .setFooter({ text: getISTString() });
}

// ─── Error Embed ──────────────────────────────────────────────────────────────

export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Error')
    .setColor(EMBED_COLORS.ERROR)
    .setDescription(message)
    .setFooter({ text: getISTString() });
}

// ─── Notification Embeds ──────────────────────────────────────────────────────

export function buildNotificationEmbed(
  event: 'online' | 'offline' | 'crashed' | 'queue_started' | 'queue_confirmed',
): EmbedBuilder {
  const embed = new EmbedBuilder().setFooter({ text: getISTString() });

  switch (event) {
    case 'online':
      embed
        .setTitle('Server Online')
        .setColor(EMBED_COLORS.ONLINE)
        .setDescription('TikdiSMP is now online and ready to connect.');
      break;
    case 'offline':
      embed
        .setTitle('Server Offline')
        .setColor(EMBED_COLORS.OFFLINE)
        .setDescription('TikdiSMP has shut down.');
      break;
    case 'crashed':
      embed
        .setTitle('Server Crashed')
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(
          'TikdiSMP has crashed unexpectedly. Manual intervention may be required.',
        );
      break;
    case 'queue_started':
      embed
        .setTitle('Server Queued')
        .setColor(EMBED_COLORS.QUEUEING)
        .setDescription(
          'TikdiSMP is now in the Aternos queue. Auto-confirmation is monitoring for queue completion.',
        );
      break;
    case 'queue_confirmed':
      embed
        .setTitle('Queue Confirmed')
        .setColor(EMBED_COLORS.STARTING)
        .setDescription(
          'The Aternos queue has been confirmed automatically. The server is now starting.',
        );
      break;
  }

  return embed;
}
