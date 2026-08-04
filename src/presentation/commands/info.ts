import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { buildInfoEmbed } from '../components/embeds';
import { commandDescription } from './shared';

export const infoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription(commandDescription('View {server} connection details')),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    // Prefer live data from the last successful ping over configured defaults.
    await interaction.reply({ embeds: [buildInfoEmbed(services.lastMinecraftStatus)] });
  },
};
