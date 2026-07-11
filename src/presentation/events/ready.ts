import { Client, TextChannel, REST, Routes } from 'discord.js';
import { BotCommand, ServiceContainer } from '../../types';
import { config } from '../../config/env';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { buildDashboardEmbed } from '../components/embeds';
import { buildDashboardButtons } from '../components/buttons';
import { StatusMonitor } from '../../application/StatusMonitor';

export async function onReady(
  client: Client,
  commands: Map<string, BotCommand>,
  services: ServiceContainer,
): Promise<void> {
  logger.info(`Bot logged in as ${client.user?.tag ?? 'Unknown'}`);

  // Register slash commands with Discord API
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);
  const commandsData = Array.from(commands.values()).map((cmd) => cmd.data.toJSON());

  try {
    logger.info('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID), {
      body: commandsData,
    });
    logger.info(`Successfully registered ${commandsData.length} slash command(s).`);
  } catch (err) {
    logger.error(`Failed to register slash commands: ${String(err)}`);
  }

  // Initialize or retrieve the dashboard message
  try {
    await initializeDashboard(client, services);
  } catch (err) {
    logger.error(`Failed to initialize dashboard: ${String(err)}`);
  }

  // Start the background polling engine
  const monitor = new StatusMonitor(services, client);
  services.forcePoll = (): void => monitor.forcePoll();
  
  // Initialize persistent browser session before starting monitor
  if (services.aternos.init) {
    try {
      await services.aternos.init();
    } catch (err) {
      logger.error(`Initial Aternos browser session failed to start: ${String(err)}`);
    }
  }
  
  monitor.start();

  logger.info('StatusMonitor started. Bot is fully operational.');
}

async function initializeDashboard(client: Client, services: ServiceContainer): Promise<void> {
  const channel = await client.channels.fetch(config.CONTROL_CHANNEL_ID);
  if (!channel || !(channel instanceof TextChannel)) {
    logger.error(`Control channel ${config.CONTROL_CHANNEL_ID} not found or is not a text channel.`);
    return;
  }

  // fetchPins() returns { hasMore, items: MessagePin[] } where each MessagePin has a .message
  const pinsResponse = await channel.messages.fetchPins();
  const existingDashboard = pinsResponse.items
    .map((pin) => pin.message)
    .find((msg) => msg.author.id === client.user?.id);

  const dashboardEmbed = buildDashboardEmbed(services.currentState, null, null);
  const dashboardButtons = buildDashboardButtons(false);

  if (existingDashboard) {
    logger.info(`Found existing dashboard message: ${existingDashboard.id}`);
    services.dashboardMessageId = existingDashboard.id;
    await existingDashboard.edit({ embeds: [dashboardEmbed], components: [dashboardButtons] });
  } else {
    // Create new dashboard message and pin it
    const dashboardMsg = await channel.send({
      embeds: [dashboardEmbed],
      components: [dashboardButtons],
    });
    await dashboardMsg.pin();
    services.dashboardMessageId = dashboardMsg.id;
    logger.info(`Dashboard message created and pinned: ${dashboardMsg.id}`);
  }
}
