import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { getUserPermissionLevel } from '../../utils/permissions';
import { buildHelpEmbed } from '../components/embeds';

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View available commands based on your permission level'),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    _services: ServiceContainer,
  ): Promise<void> {
    const member = interaction.member instanceof GuildMember ? interaction.member : null;
    const permLevel = getUserPermissionLevel(member, interaction.user.id);

    await interaction.reply({
      embeds: [buildHelpEmbed(permLevel)],
      flags: 64,
    });
  },
};
