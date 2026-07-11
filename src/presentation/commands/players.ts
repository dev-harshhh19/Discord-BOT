import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer, ServerState } from '../../types';
import { checkCommandPermission } from '../../utils/permissions';
import { buildPlayersEmbed, buildErrorEmbed } from '../components/embeds';
import { MinecraftQueryError } from '../../utils/errors';
import { logger } from '../../infrastructure/logger/WinstonLogger';

export const playersCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription('View players currently connected to TikdiSMP'),

  requiredPermission: PermissionLevel.TRUSTED,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    if (!checkCommandPermission(interaction, PermissionLevel.TRUSTED)) {
      await interaction.reply({
        embeds: [buildErrorEmbed('You do not have permission to view player data.')],
        flags: 64,
      });
      return;
    }

    if (services.currentState !== ServerState.ONLINE) {
      await interaction.reply({
        embeds: [buildErrorEmbed('The server is not online. Player data is unavailable.')],
        flags: 64,
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
      } else {
        logger.error(`/players unexpected error: ${String(err)}`);
        await interaction.editReply({
          embeds: [buildErrorEmbed('An unexpected error occurred while querying players.')],
        });
      }
    }
  },
};
