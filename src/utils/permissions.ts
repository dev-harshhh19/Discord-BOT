import { GuildMember, Interaction } from 'discord.js';
import { PermissionLevel } from '../types';
import { config } from '../config/env';
import { registrationStore } from '../infrastructure/registration/RegistrationStore';

/**
 * Resolves a user's permission level, highest match wins:
 *   Owner → Admin (user id or role) → Trusted (user id, role, or registration)
 *   → Everyone
 *
 * Self-registration (`/register`) grants Trusted only while the feature is
 * enabled, so setting REGISTRATION_ENABLED=false instantly revokes the access
 * it granted without touching the stored registry.
 */
export function getUserPermissionLevel(
  member: GuildMember | null,
  userId: string,
): PermissionLevel {
  const { ownerUserIds, adminUserIds, adminRoleIds, minecraftRoleIds, trustedUserIds, trustedRoleIds } =
    config.permissions;

  const hasRole = (roleIds: string[]): boolean =>
    member !== null && roleIds.some((roleId) => member.roles.cache.has(roleId));

  if (ownerUserIds.includes(userId)) return PermissionLevel.OWNER;
  if (adminUserIds.includes(userId) || hasRole(adminRoleIds) || hasRole(minecraftRoleIds)) return PermissionLevel.ADMIN;
  if (trustedUserIds.includes(userId) || hasRole(trustedRoleIds)) return PermissionLevel.TRUSTED;
  if (config.registration.enabled && registrationStore.has(userId)) return PermissionLevel.TRUSTED;

  return PermissionLevel.EVERYONE;
}

/**
 * Resolves the permission level for any interaction type.
 *
 * `interaction.member` is only a `GuildMember` inside a guild; in DMs it is
 * null, which correctly limits role-derived permissions to guild context.
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
      return 'Trusted Member';
    case PermissionLevel.EVERYONE:
    default:
      return 'Everyone';
  }
}
