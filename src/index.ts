import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import express from 'express';
import { config } from './config/env';
import { logger } from './infrastructure/logger/WinstonLogger';
import { PuppeteerAternosService } from './infrastructure/aternos/PuppeteerAternosService';
import { CraftpingService } from './infrastructure/minecraft/CraftpingService';
import { ServiceContainer, ServerState, BotCommand } from './types';
import { onReady } from './presentation/events/ready';
import { createInteractionHandler } from './presentation/events/interactionCreate';

// ─── Command Registry ─────────────────────────────────────────────────────────
import { startCommand } from './presentation/commands/start';
import { stopCommand } from './presentation/commands/stop';
import { restartCommand } from './presentation/commands/restart';
import { statusCommand } from './presentation/commands/status';
import { playersCommand } from './presentation/commands/players';
import { infoCommand } from './presentation/commands/info';
import { pingCommand } from './presentation/commands/ping';
import { helpCommand } from './presentation/commands/help';

// ─── Express Health Server ────────────────────────────────────────────────────
// Required for PaaS providers (Railway, Render) to keep the container alive
const app = express();
const PORT = process.env['PORT'] ?? '3000';

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    bot: 'TikdiSMP Discord Manager',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  logger.info(`Health server listening on port ${PORT}`);
});

// ─── Discord Client ───────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Service Instantiation (Dependency Injection) ─────────────────────────────

const aternosService = new PuppeteerAternosService();
const minecraftService = new CraftpingService();

const services: ServiceContainer = {
  aternos: aternosService,
  minecraft: minecraftService,
  client,
  currentState: ServerState.UNKNOWN,
  lastMinecraftStatus: null,
  serverOnlineAt: null,
  dashboardMessageId: null,
};

// ─── Command Registry ─────────────────────────────────────────────────────────

const commands = new Map<string, BotCommand>([
  ['start', startCommand],
  ['stop', stopCommand],
  ['restart', restartCommand],
  ['status', statusCommand],
  ['players', playersCommand],
  ['info', infoCommand],
  ['ping', pingCommand],
  ['help', helpCommand],
]);

// ─── Event Listeners ──────────────────────────────────────────────────────────

client.once(Events.ClientReady, () => {
  void onReady(client, commands, services);
});

client.on(Events.InteractionCreate, createInteractionHandler(commands, services));

// ─── Global Error Handlers ────────────────────────────────────────────────────

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`Unhandled promise rejection: ${String(reason)}`);
});

process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught exception: ${err.message}`);
  logger.error(err.stack ?? '');
  process.exit(1);
});

// ─── Bot Login ────────────────────────────────────────────────────────────────

logger.info('Logging in to Discord...');
void client.login(config.DISCORD_BOT_TOKEN);
