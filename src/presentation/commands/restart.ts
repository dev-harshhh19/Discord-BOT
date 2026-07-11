import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer, ServerState } from '../../types';
import { checkCommandPermission } from '../../utils/permissions';
import { buildRestartProgressEmbed, buildErrorEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';

const RESTART_SETTLE_MS = 8_000; // Wait between stop and start

export const restartCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restart the TikdiSMP server (Owner only)'),

  requiredPermission: PermissionLevel.OWNER,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    if (!checkCommandPermission(interaction, PermissionLevel.OWNER)) {
      await interaction.reply({
        embeds: [buildErrorEmbed('Only the server owner can restart the server.')],
        flags: 64,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Phase 1: Stop
      await interaction.editReply({ embeds: [buildRestartProgressEmbed('stopping')] });
      logger.info(`/restart Phase 1 (stop) initiated by ${interaction.user.tag}`);

      if (services.currentState === ServerState.ONLINE) {
        await services.aternos.stopServer();
        services.currentState = ServerState.STOPPING;
      }

      // Wait for server to settle before starting
      await new Promise((resolve) => setTimeout(resolve, RESTART_SETTLE_MS));

      // Phase 2: Start
      await interaction.editReply({ embeds: [buildRestartProgressEmbed('starting')] });
      logger.info('/restart Phase 2 (start) initiated');

      await services.aternos.startServer();
      services.currentState = ServerState.STARTING;
      services.serverOnlineAt = null;

      logger.info('/restart completed successfully');
    } catch (err) {
      logger.error(`/restart failed: ${String(err)}`);
      await interaction.editReply({
        embeds: [buildErrorEmbed(`Restart failed: ${String(err)}`)],
      });
    }
  },
};
