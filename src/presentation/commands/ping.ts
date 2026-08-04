import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { buildPingEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Measure Discord gateway and Minecraft server latency'),

  requiredPermission: PermissionLevel.TRUSTED,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    await interaction.deferReply();

    const wsLatency = interaction.client.ws.ping;

    let mcLatency: number | null = null;
    try {
      const mcStatus = await services.minecraft.pingServer();
      mcLatency = mcStatus.latency;
    } catch {
      logger.debug('Minecraft ping failed during /ping; the server is probably offline.');
    }

    await interaction.editReply({ embeds: [buildPingEmbed(wsLatency, mcLatency)] });
  },
};
