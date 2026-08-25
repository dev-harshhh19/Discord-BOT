import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { config } from '../../config/env';

export const privacyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('privacy')
    .setDescription('View the Privacy Policy for this bot and dashboard'),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    _services: ServiceContainer,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Privacy Policy')
      .setColor('#10b981')
      .setDescription(
        'Here is how we handle your data on the ' + config.branding.serverName + ' Bot & Dashboard:'
      )
      .addFields(
        {
          name: '1. Information We Collect',
          value: 'We collect your Discord Member ID, username, server roles, and any Minecraft usernames you submit during whitelist registration.',
        },
        {
          name: '2. How We Use Information',
          value: 'Your data is solely used to authenticate management commands, manage the Minecraft server whitelist, and provide live telemetry.',
        },
        {
          name: '3. Data Security',
          value: 'We do not sell or trade your data. Telemetry logs (like IPs) are anonymized in logs. No third-party tracking or analytics cookies are used.',
        }
      )
      .setFooter({ text: 'Effective Date: ' + new Date().toLocaleDateString() });

    await interaction.reply({ embeds: [embed] });
  },
};
