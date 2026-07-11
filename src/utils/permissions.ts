import { ChatInputCommandInteraction, ButtonInteraction, GuildMember } from 'discord.js';
import { PermissionLevel } from '../types';
import { config } from '../config/env';

/**
 * Resolves the permission level of a Discord user based on:
 * 1. Owner user IDs (highest precedence)
 * 2. Admin user IDs or role IDs
 * 3. Trusted user IDs or role IDs
 * 4. Everyone (default)
 */
export function getUserPermissionLevel(member: GuildMember | null, userId: string): PermissionLevel {
  // Owner check
  if (config.OWNER_USER_IDS.includes(userId)) {
    return PermissionLevel.OWNER;
  }

  // Admin check — by user ID or role
  if (config.ADMIN_USER_IDS.includes(userId)) {
    return PermissionLevel.ADMIN;
  }
  if (member && config.ADMIN_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
    return PermissionLevel.ADMIN;
  }

  // Trusted check — by user ID or role
  if (config.TRUSTED_USER_IDS.includes(userId)) {
    return PermissionLevel.TRUSTED;
  }
  if (member && config.TRUSTED_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
    return PermissionLevel.TRUSTED;
  }

  return PermissionLevel.EVERYONE;
}

/**
 * Checks if the user in a ChatInputCommandInteraction has the required permission level.
 * Returns true if authorized, false otherwise.
 */
export function checkCommandPermission(
  interaction: ChatInputCommandInteraction,
  required: PermissionLevel,
): boolean {
  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  const userId = interaction.user.id;
  const userLevel = getUserPermissionLevel(member, userId);
  return userLevel >= required;
}

/**
 * Checks if the user in a ButtonInteraction has the required permission level.
 */
export function checkButtonPermission(
  interaction: ButtonInteraction,
  required: PermissionLevel,
): boolean {
  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  const userId = interaction.user.id;
  const userLevel = getUserPermissionLevel(member, userId);
  return userLevel >= required;
}

/**
 * Returns a human-readable name for a permission level.
 */
export function permissionLevelName(level: PermissionLevel): string {
  switch (level) {
    case PermissionLevel.OWNER:
      return 'Owner';
    case PermissionLevel.ADMIN:
      return 'Admin';
    case PermissionLevel.TRUSTED:
      return 'Trusted Member';
    case PermissionLevel.EVERYONE:
      return 'Everyone';
  }
}
