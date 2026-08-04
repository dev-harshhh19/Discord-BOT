import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { resolvePermissionLevel } from '../../utils/permissions';
import { buildHelpEmbed } from '../components/embeds';

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View the commands available at your access level'),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    _services: ServiceContainer,
  ): Promise<void> {
    await interaction.reply({
      embeds: [buildHelpEmbed(resolvePermissionLevel(interaction))],
      flags: MessageFlags.Ephemeral,
    });
  },
};
