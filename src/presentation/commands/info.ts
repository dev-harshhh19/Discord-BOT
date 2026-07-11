import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { buildInfoEmbed } from '../components/embeds';

export const infoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('View static TikdiSMP server information'),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    _services: ServiceContainer,
  ): Promise<void> {
    await interaction.reply({ embeds: [buildInfoEmbed()] });
  },
};
