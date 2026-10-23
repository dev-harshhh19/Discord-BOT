import { GuildMember, Interaction, PermissionFlagsBits } from 'discord.js';
import { PermissionLevel } from '../types';
import { config } from '../config/env';
import { registrationStore } from '../infrastructure/registration/RegistrationStore';

/**
 * Resolves a user's permission level based on assigned Discord roles:
 *   Owner (Guild Owner or Owner role)
 *   → Admin (Discord Administrator permission or Admin role)
 *   → Trusted (Trusted role, Minecraft player role, or registered player)
 *   → Everyone (Standard Discord members)
 *
 * Higher-tier roles inherit all lower-tier permissions via hierarchical comparison (>=).
 */
export function getUserPermissionLevel(
  member: GuildMember | null,
  userId: string,
): PermissionLevel {
  const {
    adminRoleIds,
    trustedRoleIds,
    minecraftRoleIds,
    ownerRoleIds,
    ownerUserIds,
    adminUserIds,
    trustedUserIds,
  } = config.permissions;

  // 1. Owner Tier (Role-based: Guild Owner, configured Owner Role, or owner fallback)
  if (member) {
    const isGuildOwner = member.guild.ownerId === member.id;
    const hasOwnerRole = (ownerRoleIds ?? []).some((roleId) => member.roles.cache.has(roleId));
    if (isGuildOwner || hasOwnerRole) {
      return PermissionLevel.OWNER;
    }
  }
  if (ownerUserIds.includes(userId)) return PermissionLevel.OWNER;

  if (!member) {
    // Non-guild context (e.g. DM)
    return PermissionLevel.EVERYONE;
  }

  const hasRole = (roleIds: string[]): boolean =>
    roleIds.some((roleId) => member.roles.cache.has(roleId));

  // 2. Admin Tier (Role-based: Discord Administrator permission or assigned Admin Role)
  const hasAdminPerm = member.permissions.has(PermissionFlagsBits.Administrator);
  const hasAdminRole = hasRole(adminRoleIds);
  if (hasAdminPerm || hasAdminRole || adminUserIds.includes(userId)) {
    return PermissionLevel.ADMIN;
  }

  // 3. Trusted Tier (Level 2: Trusted Role or trusted user id fallback)
  const hasTrustedRole = hasRole(trustedRoleIds);
  if (hasTrustedRole || trustedUserIds.includes(userId)) {
    return PermissionLevel.TRUSTED;
  }

  // 4. Minecraft_Role Tier (Level 1: Minecraft Role or registered player)
  const hasMinecraftRole = hasRole(minecraftRoleIds);
  const isRegisteredPlayer = config.registration.enabled && registrationStore.has(userId);
  if (hasMinecraftRole || isRegisteredPlayer) {
    return PermissionLevel.MINECRAFT;
  }

  // 5. Everyone Tier (Level 0: Standard general commands & player commands)
  return PermissionLevel.EVERYONE;
}

/**
 * Resolves the permission level for any interaction type.
 */
export function resolvePermissionLevel(interaction: Interaction): PermissionLevel {
  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  return getUserPermissionLevel(member, interaction.user.id);
}

/** True when the interacting user meets `required`. */
export function hasPermission(interaction: Interaction, required: PermissionLevel): boolean {
  return resolvePermissionLevel(interaction) >= required;
}

/** Human-readable name for a permission level. */
export function permissionLevelName(level: PermissionLevel): string {
  switch (level) {
    case PermissionLevel.OWNER:
      return 'Owner';
    case PermissionLevel.ADMIN:
      return 'Admin';
    case PermissionLevel.TRUSTED:
      return 'Trusted';
    case PermissionLevel.MINECRAFT:
      return 'Minecraft_Role';
    case PermissionLevel.EVERYONE:
    default:
      return 'Everyone';
  }
}
