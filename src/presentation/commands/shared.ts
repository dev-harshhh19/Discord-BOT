import { config } from '../../config/env';

/** Discord rejects slash command descriptions longer than 100 characters. */
const MAX_DESCRIPTION_LENGTH = 100;

/**
 * Builds a slash command description with the configured server name
 * substituted for `{server}`, truncated to Discord's limit.
 *
 * Command descriptions used to hardcode a specific server name, which meant
 * anyone reusing the bot saw someone else's branding in their command list.
 */
export function commandDescription(template: string): string {
  const description = template.replace('{server}', config.branding.serverName);
  return description.length <= MAX_DESCRIPTION_LENGTH
    ? description
    : `${description.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}

/** Extracts a user-safe message from an unknown error, without a stack trace. */
export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
