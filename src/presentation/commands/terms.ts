import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer } from '../../types';
import { config } from '../../config/env';

export const termsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('terms')
    .setDescription('View the Terms of Service for this bot and dashboard'),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    _services: ServiceContainer,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📜 Terms of Service')
      .setColor('#2563eb')
      .setDescription(
        'By using the ' + config.branding.serverName + ' Bot & Dashboard, you agree to the following terms:'
      )
      .addFields(
        {
          name: '1. Use of Service',
          value: 'This service provides telemetry and management for our Minecraft server. Authorized administrators are granted access to execute power commands.',
        },
        {
          name: '2. Acceptable Use',
          value: 'Do not abuse the bot commands, API endpoints, or dashboard features. All interactions must comply with Discord and Aternos Terms of Service.',
        },
        {
          name: '3. Data & Privacy',
          value: 'For details on how we handle your Discord and Minecraft data, please use the `/privacy` command.',
        }
      )
      .setFooter({ text: 'Effective Date: ' + new Date().toLocaleDateString() });

    await interaction.reply({ embeds: [embed] });
  },
};
