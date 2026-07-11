import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { buildStatusEmbed } from '../components/embeds';

export const statusCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('View the current TikdiSMP server status'),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    await interaction.reply({
      embeds: [
        buildStatusEmbed(
          services.currentState,
          services.lastMinecraftStatus,
          services.serverOnlineAt,
        ),
      ],
    });
  },
};
