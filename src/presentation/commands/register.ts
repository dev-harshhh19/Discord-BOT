import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer, EMBED_COLORS } from '../../types';
import { registrationStore } from '../../infrastructure/registration/RegistrationStore';
import { resolvePermissionLevel, permissionLevelName } from '../../utils/permissions';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { commandDescription } from './shared';
import { config } from '../../config/env';

/**
 * Self-service registration.
 *
 * Registered users are persisted to the on-disk registry and resolved as
 * Trusted on every future interaction, so a registration survives restarts and
 * automatically applies to later server launches. The command is only wired up
 * when REGISTRATION_ENABLED=true (see the command map in index.ts), keeping the
 * feature fully removable through configuration alone.
 */
export const registerCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription(commandDescription('Register your Minecraft player name for {server} access'))
    .addStringOption((option) =>
      option
        .setName('player_name')
        .setDescription('Your Minecraft in-game username (IGN)')
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(32),
    ),

  requiredPermission: PermissionLevel.EVERYONE,

  async execute(
    interaction: ChatInputCommandInteraction,
    _services: ServiceContainer,
  ): Promise<void> {
    const playerName = interaction.options.getString('player_name', true).trim();
    const existingLevel = resolvePermissionLevel(interaction);

    const result = registrationStore.register(interaction.user.id, interaction.user.tag, playerName);
    const headAvatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/64`;

    if (result.isNew) {
      const embed = new EmbedBuilder()
        .setTitle('Registration Complete')
        .setColor(EMBED_COLORS.ONLINE)
        .setDescription(
          `Welcome! You are now registered as a **Trusted Member** of **${config.branding.serverName}**.\n\n` +
            `• **Linked Minecraft IGN:** \`${playerName}\`\n` +
            `• **Discord Member:** <@${interaction.user.id}>\n` +
            `• **Granted Permissions:** \`/start\`, \`/players\`, \`/ping\`\n\n` +
            'Your access applies automatically across server launches and appears on the web dashboard.',
        )
        .setThumbnail(headAvatarUrl);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

      logger.info(
        `/register: ${interaction.user.tag} (${interaction.user.id}) registered with Minecraft IGN "${playerName}" ` +
          `(${registrationStore.count} total registered).`,
      );
      return;
    }

    if (result.updated) {
      const embed = new EmbedBuilder()
        .setTitle('Registration Updated')
        .setColor(EMBED_COLORS.ONLINE)
        .setDescription(
          `Your linked Minecraft player name has been updated to **\`${playerName}\`**.\n\n` +
            `• **Discord Member:** <@${interaction.user.id}>\n` +
            `• **Permission Level:** **${permissionLevelName(existingLevel)}**`,
        )
        .setThumbnail(headAvatarUrl);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

      logger.info(
        `/register: ${interaction.user.tag} (${interaction.user.id}) updated Minecraft IGN to "${playerName}".`,
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Already Registered')
      .setColor(EMBED_COLORS.INFO)
      .setDescription(
        `You are already registered with Minecraft IGN **\`${playerName}\`**.\n` +
          `Your current access level is **${permissionLevelName(existingLevel)}**.`,
      )
      .setThumbnail(headAvatarUrl);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
