import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServerState, ServiceContainer } from '../../types';
import { checkCommandPermission } from '../../utils/permissions';
import { buildStartingEmbed, buildErrorEmbed, buildStatusEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';

export const startCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start the TikdiSMP Minecraft server'),

  requiredPermission: PermissionLevel.TRUSTED,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    if (!checkCommandPermission(interaction, PermissionLevel.TRUSTED)) {
      await interaction.reply({
        embeds: [buildErrorEmbed('You do not have permission to start the server.')],
        flags: 64,
      });
      return;
    }

    // Prevent duplicate start
    const state = services.currentState;
    if (state === ServerState.ONLINE) {
      await interaction.reply({
        embeds: [buildStatusEmbed(state, services.lastMinecraftStatus, services.serverOnlineAt)],
        flags: 64,
      });
      return;
    }

    if (state === ServerState.STARTING || state === ServerState.QUEUEING) {
      await interaction.reply({
        embeds: [buildErrorEmbed(`Server is already ${state.toLowerCase()}. Please wait.`)],
        flags: 64,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await services.aternos.startServer();
      services.currentState = ServerState.STARTING;

      await interaction.editReply({ embeds: [buildStartingEmbed()] });
      logger.info(`/start invoked by ${interaction.user.tag}`);
      
      // Force a poll to update dashboard with Queue info instantly
      if (services.forcePoll) {
        services.forcePoll();
      }
    } catch (err) {
      logger.error(`Failed to start server: ${String(err)}`);
      await interaction.editReply({
        embeds: [buildErrorEmbed(`Failed to send start command: ${String(err)}`)],
      });
    }
  },
};
