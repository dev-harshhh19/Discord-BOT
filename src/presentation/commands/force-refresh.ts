import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { buildStatusEmbed, buildErrorEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { describeError } from './shared';

export const forceRefreshCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('force-refresh')
    .setDescription('Clear all caches, reload Aternos panel, and fetch fresh live status (Owner only)'),

  requiredPermission: PermissionLevel.OWNER,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    await interaction.deferReply();

    try {
      logger.info(`/force-refresh triggered by ${interaction.user.tag}. Flushing all caches...`);

      let freshState = services.currentState;
      let freshMcStatus = services.lastMinecraftStatus;

      if (services.forceRefresh) {
        const result = await services.forceRefresh();
        freshState = result.state;
        freshMcStatus = result.mcStatus;
      } else if (services.forcePoll) {
        services.forcePoll();
      }

      const embed = buildStatusEmbed(
        freshState,
        freshMcStatus,
        services.serverOnlineAt,
      );

      embed.setTitle('Force Refresh Complete');
      embed.setDescription(
        `All memory caches flushed and Aternos panel reloaded.\n**Current Live Status:** \`${freshState}\``,
      );
      embed.setFooter({ text: `Forced fresh sync by ${interaction.user.tag} • Live Data` });

      await interaction.editReply({ embeds: [embed] });
      logger.info(`/force-refresh complete. Live status is ${freshState}.`);
    } catch (err) {
      logger.error(`/force-refresh failed: ${String(err)}`);
      await interaction.editReply({
        embeds: [buildErrorEmbed(`Force refresh failed: ${describeError(err)}`)],
      });
    }
  },
};
