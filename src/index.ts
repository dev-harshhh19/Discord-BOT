import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config, configWarnings } from './config/env';
import { describePlatform } from './config/platform';
import { APP_ROOT } from './config/paths';
import { describeLogDestination, logger } from './infrastructure/logger/WinstonLogger';
import { PuppeteerAternosService } from './infrastructure/aternos/PuppeteerAternosService';
import { CraftpingService } from './infrastructure/minecraft/CraftpingService';
import { installSignalHandlers, onShutdown, shutdown } from './infrastructure/lifecycle/shutdown';
import { BotCommand, ServerState, ServiceContainer } from './types';
import { onReady } from './presentation/events/ready';
import { createInteractionHandler } from './presentation/events/interactionCreate';
import { startWebServer } from './presentation/web/server';

import { startCommand } from './presentation/commands/start';
import { stopCommand } from './presentation/commands/stop';
import { restartCommand } from './presentation/commands/restart';
import { statusCommand } from './presentation/commands/status';
import { playersCommand } from './presentation/commands/players';
import { infoCommand } from './presentation/commands/info';
import { pingCommand } from './presentation/commands/ping';
import { helpCommand } from './presentation/commands/help';
import { registerCommand } from './presentation/commands/register';
import { forceRefreshCommand } from './presentation/commands/force-refresh';

const commands = new Map<string, BotCommand>([
  ['start', startCommand],
  ['stop', stopCommand],
  ['restart', restartCommand],
  ['force-refresh', forceRefreshCommand],
  ['status', statusCommand],
  ['players', playersCommand],
  ['info', infoCommand],
  ['ping', pingCommand],
  ['help', helpCommand],
]);

// Self-registration is opt-in: when disabled the command is neither routed nor
// registered with Discord, so it simply does not exist for users.
if (config.registration.enabled) {
  commands.set('register', registerCommand);
}

/**
 * Gateway intents.
 *
 * `GuildMembers` is a privileged intent: if it is requested but not enabled in
 * the Discord Developer Portal, login fails outright with "Used disallowed
 * intents". It is therefore only requested when the feature that needs it — the
 * dashboard's member listing — has been explicitly turned on.
 */
function resolveIntents(): GatewayIntentBits[] {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
  if (config.web.enabled && config.web.exposeMembers) {
    intents.push(GatewayIntentBits.GuildMembers);
  }
  return intents;
}

async function main(): Promise<void> {
  installSignalHandlers();

  logger.info('─'.repeat(64));
  logger.info(`${config.branding.serverName} — Discord server manager`);
  logger.info(`Platform : ${describePlatform()}`);
  logger.info(`App root : ${APP_ROOT}`);
  logger.info(`Logging  : ${describeLogDestination()} (level ${config.logging.level})`);
  logger.info(`Timezone : ${config.timezone}`);
  logger.info(
    `Browser  : ${config.browser.executablePath ?? 'puppeteer bundled'} ` +
      `(${config.browser.headless ? 'headless' : 'headful'})`,
  );
  logger.info('─'.repeat(64));

  // Emitted here rather than at load time, so they go through the logger.
  for (const warning of configWarnings) {
    logger.warn(warning);
  }

  const client = new Client({ intents: resolveIntents() });
  const aternos = new PuppeteerAternosService();
  const minecraft = new CraftpingService();

  const services: ServiceContainer = {
    aternos,
    minecraft,
    client,
    currentState: ServerState.UNKNOWN,
    lastMinecraftStatus: null,
    serverOnlineAt: null,
    dashboardMessageId: null,
  };

  // Cleanup runs in reverse registration order: web → discord → browser.
  onShutdown('aternos browser', () => aternos.close());
  onShutdown('discord client', async () => {
    await client.destroy();
  });

  const server = await startWebServer(services, commands, client);
  if (server) {
    onShutdown('web server', async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  }

  client.once(Events.ClientReady, () => {
    void onReady(client, commands, services);
  });

  const handleInteraction = createInteractionHandler(commands, services);
  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction);
  });

  client.on(Events.Error, (err) => {
    logger.error(`Discord client error: ${err.message}`);
  });
  client.on(Events.Warn, (message) => {
    logger.warn(`Discord client warning: ${message}`);
  });

  logger.info('Logging in to Discord...');
  try {
    await client.login(config.discord.token);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('disallowed intents')) {
      logger.error(
        'Discord rejected the requested gateway intents. Enable "Server Members Intent" ' +
          'in the Developer Portal, or set WEB_EXPOSE_MEMBERS=false.',
      );
    } else if (message.includes('TOKEN_INVALID') || message.includes('invalid token')) {
      logger.error('DISCORD_BOT_TOKEN was rejected. Regenerate it in the Developer Portal.');
    } else {
      logger.error(`Discord login failed: ${message}`);
    }
    await shutdown('login failure', 1);
  }
}

void main().catch((err: unknown) => {
  logger.error(`Fatal error during startup: ${String(err)}`);
  void shutdown('startup failure', 1);
});
