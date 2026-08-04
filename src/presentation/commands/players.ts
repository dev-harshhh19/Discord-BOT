import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer, ServerState } from '../../types';
import { buildPlayersEmbed, buildErrorEmbed } from '../components/embeds';
import { MinecraftQueryError } from '../../utils/errors';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { commandDescription } from './shared';

export const playersCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription(commandDescription('View players currently connected to {server}')),

  requiredPermission: PermissionLevel.TRUSTED,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    if (services.currentState !== ServerState.ONLINE) {
      await interaction.reply({
        embeds: [buildErrorEmbed('The server is not online, so player data is unavailable.')],
      });
      return;
    }

    await interaction.deferReply();

    try {
      const mcStatus = await services.minecraft.pingServer();
      await interaction.editReply({ embeds: [buildPlayersEmbed(mcStatus)] });
    } catch (err) {
      if (err instanceof MinecraftQueryError) {
        logger.warn(`/players query failed: ${err.message}`);
        await interaction.editReply({
          embeds: [buildErrorEmbed('Could not reach the Minecraft server. Try again shortly.')],
        });
        return;
      }
      logger.error(`/players failed unexpectedly: ${String(err)}`);
      await interaction.editReply({
        embeds: [buildErrorEmbed('An unexpected error occurred while querying players.')],
      });
    }
  },
};
