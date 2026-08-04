/**
 * Timezone-aware formatting helpers.
 *
 * The previous implementation added a fixed +5:30 offset to `Date.now()` and
 * relabelled the result "IST". That is wrong for anyone outside India, and it
 * also mislabels the value — the shifted timestamp is not a valid UTC instant,
 * so any consumer parsing it back gets a time 5.5 hours in the future. All
 * formatting now goes through `Intl` with a configurable IANA zone.
 */

let timeZone = 'UTC';
let zoneLabel = 'UTC';

/** Set once at startup from `config.timezone`. */
export function configureTimezone(zone: string): void {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    timeZone = zone;
    zoneLabel = shortZoneName(zone);
  } catch {
    timeZone = 'UTC';
    zoneLabel = 'UTC';
  }
}

function shortZoneName(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? zone;
  } catch {
    return zone;
  }
}

/**
 * Human-readable timestamp for embeds.
 * Example: "03 Aug 2026, 17:30:00 IST"
 */
export function formatTimestamp(date: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatted} ${zoneLabel}`;
}

/**
 * Sortable timestamp for log lines.
 * Example: "2026-08-03 17:30:00 IST"
 */
export function formatLogTimestamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';

  // Some ICU builds render midnight as hour "24"; normalise it.
  const hour = get('hour') === '24' ? '00' : get('hour');

  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')} ${zoneLabel}`;
}

/**
 * Formats an elapsed duration as a compact human string.
 * Example: 3661000 ms → "1h 1m 1s"
 */
export function formatUptime(startTime: Date, now: Date = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Renders a Date as a Discord relative timestamp (`<t:UNIX:R>`), which Discord
 * localises per-viewer — preferable to any server-side zone for user-facing text.
 */
export function toDiscordTimestamp(date: Date, style: 'R' | 'f' | 'F' | 't' = 'R'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

/** Promise-based delay. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
