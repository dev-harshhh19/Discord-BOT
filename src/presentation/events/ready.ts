import { Client, TextChannel, REST, Routes } from 'discord.js';
import { BotCommand, ServiceContainer, ServerState, MinecraftStatus } from '../../types';
import { config } from '../../config/env';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { buildDashboardEmbed } from '../components/embeds';
import { buildDashboardButtons } from '../components/buttons';
import { StatusMonitor } from '../../application/StatusMonitor';
import { onShutdown } from '../../infrastructure/lifecycle/shutdown';

export async function onReady(
  client: Client,
  commands: Map<string, BotCommand>,
  services: ServiceContainer,
): Promise<void> {
  logger.info(`Logged in as ${client.user?.tag ?? 'unknown'}.`);

  await registerCommands(commands);

  if (config.discord.guildId) {
    try {
      const guild = await client.guilds.fetch(config.discord.guildId);
      if (guild) {
        await guild.members.fetch();
        logger.info(`Prefetched ${guild.memberCount} members for guild "${guild.name}".`);
      }
    } catch (err) {
      logger.warn(`Could not prefetch guild members: ${String(err)}`);
    }
  }

  await initializeDashboard(client, services).catch((err: unknown) => {
    logger.error(`Could not initialise the dashboard: ${String(err)}`);
  });

  const monitor = new StatusMonitor(services, client);
  services.forcePoll = (): void => monitor.forcePoll();
  services.forceRefresh = (): Promise<{ state: ServerState; mcStatus: MinecraftStatus | null }> =>
    monitor.forceRefresh();
  services.beginLaunchWatch = (): void => monitor.beginLaunchWatch();
  onShutdown('status monitor', () => monitor.stop());

  // Warm the browser session before polling starts, so the first poll does not
  // pay the cost of a cold Chromium launch. A failure here is not fatal: the
  // service relaunches on demand, and the direct Minecraft ping still works.
  if (services.aternos.init) {
    try {
      await services.aternos.init();
    } catch (err) {
      logger.error(`Could not open the initial Aternos session: ${String(err)}`);
      logger.warn('Continuing without a browser session; it will retry on the next action.');
    }
  }

  monitor.start();
  logger.info('Bot is fully operational.');
}

/**
 * Registers slash commands.
 *
 * Guild registration is instant and is the default. When `DISCORD_GUILD_ID` is
 * unset the commands register globally instead, which lets the bot serve
 * multiple servers at the cost of up to an hour of propagation delay.
 */
async function registerCommands(commands: Map<string, BotCommand>): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const body = Array.from(commands.values()).map((cmd) => cmd.data.toJSON());

  try {
    if (config.discord.guildId !== null) {
      logger.info(`Registering ${body.length} slash commands for guild ${config.discord.guildId}…`);
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body },
      );
    } else {
      logger.info(`Registering ${body.length} slash commands globally (may take up to an hour)…`);
      await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
    }
    logger.info('Slash commands registered.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Missing Access') || message.includes('50001')) {
      logger.error(
        'Discord refused the command registration. Re-invite the bot with the ' +
          '"applications.commands" scope, and check DISCORD_GUILD_ID is correct.',
      );
    } else {
      logger.error(`Failed to register slash commands: ${message}`);
    }
  }
}

/**
 * Finds the pinned dashboard message, or creates and pins one.
 *
 * Reusing the existing pin keeps a single dashboard across restarts instead of
 * accumulating a new one each time the bot starts.
 */
async function initializeDashboard(client: Client, services: ServiceContainer): Promise<void> {
  const channel = await client.channels.fetch(config.discord.controlChannelId).catch(() => null);

  if (!channel) {
    logger.error(
      `Control channel ${config.discord.controlChannelId} could not be fetched. ` +
        'Check CONTROL_CHANNEL_ID and that the bot can see the channel.',
    );
    return;
  }

  if (!(channel instanceof TextChannel)) {
    logger.error(`Control channel ${config.discord.controlChannelId} is not a text channel.`);
    return;
  }

  const embed = buildDashboardEmbed(services.currentState, null, null);
  const buttons = buildDashboardButtons(ServerState.UNKNOWN);

  try {
    const pins = await channel.messages.fetchPins();
    const existing = pins.items
      .map((pin) => pin.message)
      .find((message) => message.author.id === client.user?.id);

    if (existing) {
      services.dashboardMessageId = existing.id;
      await existing.edit({ embeds: [embed], components: [buttons] });
      logger.info(`Reusing the existing dashboard message ${existing.id}.`);
      return;
    }
  } catch (err) {
    logger.warn(`Could not read pinned messages: ${String(err)}`);
  }

  const message = await channel.send({ embeds: [embed], components: [buttons] });
  services.dashboardMessageId = message.id;

  try {
    await message.pin();
    logger.info(`Created and pinned the dashboard message ${message.id}.`);
  } catch (err) {
    // Pinning needs ManageMessages; the dashboard still works unpinned, but it
    // will not be found again after a restart.
    logger.warn(
      `Created the dashboard message ${message.id} but could not pin it ` +
        `(grant the bot "Manage Messages" so it is reused after a restart): ${String(err)}`,
    );
  }
}
