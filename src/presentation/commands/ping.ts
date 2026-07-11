import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { checkCommandPermission } from '../../utils/permissions';
import { buildPingEmbed, buildErrorEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Measure Discord WebSocket and Minecraft server latency'),

  requiredPermission: PermissionLevel.TRUSTED,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    if (!checkCommandPermission(interaction, PermissionLevel.TRUSTED)) {
      await interaction.reply({
        embeds: [buildErrorEmbed('You do not have permission to use /ping.')],
        flags: 64,
      });
      return;
    }

    await interaction.deferReply();

    // Discord WebSocket latency
    const wsLatency = interaction.client.ws.ping;

    // Minecraft server latency
    let mcLatency: number | null = null;
    try {
      const mcStatus = await services.minecraft.pingServer();
      mcLatency = mcStatus.latency;
    } catch {
      logger.debug('Minecraft ping failed during /ping command — server may be offline.');
    }

    await interaction.editReply({
      embeds: [buildPingEmbed(wsLatency, mcLatency)],
    });
  },
};
