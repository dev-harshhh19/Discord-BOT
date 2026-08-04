import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  MessageFlags,
  RepliableInteraction,
} from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { hasPermission, permissionLevelName } from '../../utils/permissions';
import { buildErrorEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { config } from '../../config/env';
import { buttonHandlers } from './buttonHandlers';

/**
 * Interaction router.
 *
 * Permission enforcement lives here, not inside individual commands. Each
 * command declares `requiredPermission` and the router is the only thing that
 * reads it. Previously the field was declared but never checked, and every
 * command re-implemented its own gate — so a command that forgot to would have
 * been open to everyone.
 */
export function createInteractionHandler(
  commands: Map<string, BotCommand>,
  services: ServiceContainer,
): (interaction: Interaction) => Promise<void> {
  return async (interaction: Interaction): Promise<void> => {
    if (interaction.isChatInputCommand()) {
      await routeCommand(interaction, commands, services);
    } else if (interaction.isButton()) {
      await routeButton(interaction, services);
    }
  };
}

async function routeCommand(
  interaction: ChatInputCommandInteraction,
  commands: Map<string, BotCommand>,
  services: ServiceContainer,
): Promise<void> {
  const command = commands.get(interaction.commandName);
  if (!command) {
    logger.warn(`Received an unregistered slash command: /${interaction.commandName}`);
    return;
  }

  if (!(await enforceGuild(interaction))) return;
  if (!(await enforcePermission(interaction, command.requiredPermission))) return;

  try {
    await command.execute(interaction, services);
  } catch (err) {
    logger.error(`/${interaction.commandName} failed: ${String(err)}`);
    await respondWithError(interaction, 'An internal error occurred. Please try again.');
  }
}

async function routeButton(
  interaction: ButtonInteraction,
  services: ServiceContainer,
): Promise<void> {
  const handler = buttonHandlers.get(interaction.customId);
  if (!handler) {
    logger.warn(`Received an unknown button interaction: ${interaction.customId}`);
    return;
  }

  if (!(await enforceGuild(interaction))) return;
  if (!(await enforcePermission(interaction, handler.requiredPermission))) return;

  try {
    await handler.execute(interaction, services);
  } catch (err) {
    logger.error(`Button ${interaction.customId} failed: ${String(err)}`);
    await respondWithError(interaction, 'An internal error occurred.');
  }
}

/**
 * Rejects interactions from outside the configured guild.
 *
 * Commands are registered per-guild, but buttons live on messages and a bot
 * invited to a second server could otherwise be driven from it.
 */
async function enforceGuild(interaction: RepliableInteraction): Promise<boolean> {
  if (config.discord.guildId === null) return true;
  if (interaction.guildId === config.discord.guildId) return true;

  logger.warn(
    `Ignoring an interaction from guild ${String(interaction.guildId)} ` +
      `(expected ${config.discord.guildId}).`,
  );
  await respondWithError(interaction, 'This bot is not configured for use here.');
  return false;
}

async function enforcePermission(
  interaction: RepliableInteraction,
  required: PermissionLevel,
): Promise<boolean> {
  if (required === PermissionLevel.EVERYONE) return true;
  if (hasPermission(interaction, required)) return true;

  await respondWithError(
    interaction,
    `This action requires **${permissionLevelName(required)}** access or higher.`,
  );
  return false;
}

/** Sends an error embed whether or not the interaction was already deferred. */
async function respondWithError(
  interaction: RepliableInteraction,
  message: string,
): Promise<void> {
  try {
    const embeds = [buildErrorEmbed(message)];
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds });
    } else {
      await interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    // The interaction token may have expired, or the reply may already be used.
    logger.debug(`Could not deliver an error response: ${String(err)}`);
  }
}
