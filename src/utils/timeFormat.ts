/** Indian Standard Time offset: UTC+5:30 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns current IST time as a human-readable string.
 * Example: "11 Jul 2026, 17:30:00 IST"
 */
export function getISTString(): string {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return now.toUTCString().replace('GMT', 'IST');
}

/**
 * Formats a duration in milliseconds to HH:MM:SS string.
 * Example: 3661000 -> "1h 1m 1s"
 */
export function formatUptime(startTime: Date): string {
  const elapsedMs = Date.now() - startTime.getTime();
  const totalSeconds = Math.floor(elapsedMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Formats a Date object to a Discord Unix timestamp string.
 * Used for <t:UNIX:R> relative formatting in embeds.
 */
export function toDiscordTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

/**
 * Returns a compact IST timestamp for log lines.
 * Example: "2026-07-11 17:30:00 IST"
 */
export function getLogTimestamp(): string {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return now.toISOString().replace('T', ' ').replace('Z', ' IST').substring(0, 23) + ' IST';
}
