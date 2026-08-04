import dotenv from 'dotenv';
import { LOG_DIR, PUBLIC_DIR, SESSION_DIR, resolvePath } from './paths';
import { buildChromiumArgs, defaultUserAgent, platform, resolveChromiumPath } from './platform';

/**
 * Configuration loading and validation.
 *
 * Two deliberate behaviours:
 *
 *  - `.env` does NOT override the real process environment. A stale `.env` left
 *    in a deploy directory silently shadowing the variables set by systemd,
 *    Docker, Railway or Render is a genuinely hard bug to diagnose, so the real
 *    environment always wins and `.env` only fills the gaps.
 *  - Validation errors are collected and reported together. Fixing one missing
 *    variable per restart is miserable on a phone over SSH.
 */
dotenv.config({ override: false });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppConfig {
  discord: {
    token: string;
    clientId: string;
    /** `null` registers commands globally instead of to a single guild. */
    guildId: string | null;
    controlChannelId: string;
  };
  aternos: {
    username: string;
    password: string;
    session: string | undefined;
    serverUrl: string;
    /** Parsed out of `serverUrl`; empty when the URL carries no identifier. */
    serverId: string;
  };
  minecraft: {
    address: string;
    port: number;
    pingTimeoutMs: number;
    failureThreshold: number;
    /** Display-only metadata for `/info`; falls back to live ping data. */
    version: string;
    software: string;
    ram: string;
    region: string;
  };
  permissions: {
    ownerUserIds: string[];
    adminUserIds: string[];
    adminRoleIds: string[];
    minecraftRoleIds: string[];
    trustedUserIds: string[];
    trustedRoleIds: string[];
  };
  polling: {
    normalIntervalMs: number;
    queueIntervalMs: number;
    /** Fast interval used from a start request until the server is online. */
    launchIntervalMs: number;
    /** Ceiling on a launch watch; past this the fast polling gives up. */
    launchTimeoutMs: number;
    /** How long the server may sit in the queue before a re-queue is forced. */
    queueStuckMs: number;
    maxQueueRestarts: number;
  };
  browser: {
    headless: boolean;
    executablePath: string | undefined;
    userDataDir: string;
    args: string[];
    userAgent: string;
    navigationTimeoutMs: number;
    selectorTimeoutMs: number;
    /** Ceiling for any single browser operation, so a hung page cannot wedge the bot. */
    operationTimeoutMs: number;
  };
  logging: {
    level: string;
    dir: string | null;
    toFile: boolean;
    maxSizeBytes: number;
    maxFiles: number;
  };
  web: {
    enabled: boolean;
    port: number;
    host: string;
    /** Shared secret or Admin password required for control actions / logs. */
    adminPassword: string;
    token: string;
    /** Whether /api/members may enumerate the guild's members. */
    exposeMembers: boolean;
    /** Directory served as the dashboard UI. */
    staticDir: string;
  };
  branding: {
    serverName: string;
    footer: string;
  };
  registration: {
    /** Whether the self-service /register command is available. */
    enabled: boolean;
  };
  /** IANA timezone name used for every user-visible timestamp. */
  timezone: string;
}

// ─── Collecting validators ────────────────────────────────────────────────────

const errors: string[] = [];
const warnings: string[] = [];

function raw(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function requireStr(key: string, hint?: string): string {
  const value = raw(key);
  if (value === undefined) {
    errors.push(`${key} is required${hint ? ` — ${hint}` : ''}`);
    return '';
  }
  return value;
}

function optStr(key: string, fallback: string): string {
  return raw(key) ?? fallback;
}

function optInt(key: string, fallback: number, min?: number, max?: number): number {
  const value = raw(key);
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    errors.push(`${key} must be an integer, got "${value}"`);
    return fallback;
  }
  if (min !== undefined && parsed < min) {
    warnings.push(`${key}=${parsed} is below the minimum of ${min}; using ${min}`);
    return min;
  }
  if (max !== undefined && parsed > max) {
    warnings.push(`${key}=${parsed} is above the maximum of ${max}; using ${max}`);
    return max;
  }
  return parsed;
}

function optBool(key: string, fallback: boolean): boolean {
  const value = raw(key)?.toLowerCase();
  if (value === undefined) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  errors.push(`${key} must be a boolean (true/false), got "${value}"`);
  return fallback;
}

function optList(key: string): string[] {
  const value = raw(key);
  if (value === undefined) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Discord snowflakes are 17-20 digit decimal strings. */
function validateSnowflake(key: string, value: string, required: boolean): string {
  if (value === '') {
    if (required) return value; // already reported by requireStr
    return value;
  }
  if (!/^\d{17,20}$/.test(value)) {
    errors.push(`${key} does not look like a Discord ID (expected 17-20 digits), got "${value}"`);
  }
  return value;
}

function validateSnowflakeList(key: string, values: string[]): string[] {
  const bad = values.filter((v) => !/^\d{17,20}$/.test(v));
  if (bad.length > 0) {
    errors.push(`${key} contains invalid Discord IDs: ${bad.join(', ')}`);
  }
  return values;
}

function validateTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return tz;
  } catch {
    warnings.push(`TIMEZONE "${tz}" is not a valid IANA zone; falling back to UTC`);
    return 'UTC';
  }
}

/**
 * Extracts the Aternos server identifier from any of the URL shapes users paste:
 *   https://aternos.org/server/ABC123   → ABC123
 *   https://aternos.org/go/#ABC123      → ABC123
 *   https://aternos.org/server/         → '' (server selected by account cookie)
 *   ABC123                              → ABC123
 */
export function extractServerId(serverUrl: string): string {
  const input = serverUrl.trim();
  if (input === '') return '';

  // A bare identifier with no URL structure.
  if (!input.includes('/') && !input.includes(':')) return input;

  const hashIndex = input.indexOf('#');
  if (hashIndex !== -1) {
    const fragment = input.slice(hashIndex + 1).trim();
    if (fragment !== '') return fragment;
  }

  const withoutHash = hashIndex === -1 ? input : input.slice(0, hashIndex);
  const withoutQuery = withoutHash.split('?')[0] ?? '';
  const segments = withoutQuery
    .replace(/^https?:\/\//i, '')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const last = segments[segments.length - 1];
  if (last === undefined) return '';
  // 'aternos.org', 'server' and 'go' are structural, not identifiers.
  if (/^(aternos\.org|www\.aternos\.org|server|servers|go)$/i.test(last)) return '';
  return last;
}

// ─── Assembly ─────────────────────────────────────────────────────────────────

const serverUrl = requireStr('ATERNOS_SERVER_URL', 'e.g. https://aternos.org/server/');
const timezone = validateTimezone(optStr('TIMEZONE', 'UTC'));

const normalIntervalMs = optInt('POLL_INTERVAL_SECONDS', 45, 15, 3600) * 1000;
const queueIntervalMs = optInt('QUEUE_POLL_INTERVAL_SECONDS', 120, 15, 3600) * 1000;
const launchIntervalMs = optInt('LAUNCH_POLL_INTERVAL_SECONDS', 10, 5, 300) * 1000;

const executablePath = resolveChromiumPath();
const headless = optBool('PUPPETEER_HEADLESS', true);
const remoteDebuggingPort = optInt('PUPPETEER_REMOTE_DEBUGGING_PORT', 0, 0, 65535);
const extraArgs = optList('PUPPETEER_EXTRA_ARGS');

const logDirRequested = optBool('LOG_TO_FILE', true);

export const config: AppConfig = {
  discord: {
    token: requireStr('DISCORD_BOT_TOKEN', 'from the Discord Developer Portal → Bot → Token'),
    clientId: validateSnowflake('DISCORD_CLIENT_ID', requireStr('DISCORD_CLIENT_ID'), true),
    guildId: raw('DISCORD_GUILD_ID')
      ? validateSnowflake('DISCORD_GUILD_ID', raw('DISCORD_GUILD_ID') ?? '', false)
      : null,
    controlChannelId: validateSnowflake(
      'CONTROL_CHANNEL_ID',
      requireStr('CONTROL_CHANNEL_ID'),
      true,
    ),
  },

  aternos: {
    username: requireStr('ATERNOS_USERNAME'),
    password: requireStr('ATERNOS_PASSWORD'),
    session: raw('ATERNOS_SESSION'),
    serverUrl,
    serverId: extractServerId(serverUrl),
  },

  minecraft: {
    address: requireStr('MC_SERVER_ADDRESS', 'e.g. myserver.aternos.me'),
    port: optInt('MC_SERVER_PORT', 25565, 1, 65535),
    pingTimeoutMs: optInt('MC_PING_TIMEOUT_MS', 8000, 1000, 60000),
    failureThreshold: optInt('MC_FAILURE_THRESHOLD', 2, 1, 10),
    version: optStr('MC_VERSION', 'Unknown'),
    software: optStr('MC_SOFTWARE', 'Unknown'),
    ram: optStr('MC_RAM', 'Unknown'),
    region: optStr('MC_REGION', 'Unknown'),
  },

  permissions: {
    ownerUserIds: validateSnowflakeList('OWNER_USER_IDS', optList('OWNER_USER_IDS')),
    adminUserIds: validateSnowflakeList('ADMIN_USER_IDS', optList('ADMIN_USER_IDS')),
    adminRoleIds: validateSnowflakeList('ADMIN_ROLE_IDS', optList('ADMIN_ROLE_IDS')),
    minecraftRoleIds: validateSnowflakeList('MINECRAFT_ROLE_IDS', optList('MINECRAFT_ROLE_IDS')),
    trustedUserIds: validateSnowflakeList('TRUSTED_USER_IDS', optList('TRUSTED_USER_IDS')),
    trustedRoleIds: validateSnowflakeList('TRUSTED_ROLE_IDS', optList('TRUSTED_ROLE_IDS')),
  },

  polling: {
    normalIntervalMs,
    queueIntervalMs,
    launchIntervalMs,
    launchTimeoutMs: optInt('LAUNCH_WATCH_TIMEOUT_MINUTES', 45, 5, 240) * 60_000,
    queueStuckMs: optInt('QUEUE_STUCK_MINUTES', 10, 1, 240) * 60_000,
    maxQueueRestarts: optInt('MAX_QUEUE_RESTARTS', 2, 0, 10),
  },

  browser: {
    headless,
    executablePath,
    userDataDir: raw('SESSION_DIR') ? resolvePath(raw('SESSION_DIR') ?? '') : SESSION_DIR,
    args: buildChromiumArgs({
      remoteDebuggingPort: remoteDebuggingPort > 0 ? remoteDebuggingPort : null,
      extraArgs,
    }),
    userAgent: optStr('PUPPETEER_USER_AGENT', defaultUserAgent()),
    navigationTimeoutMs: optInt('PUPPETEER_NAVIGATION_TIMEOUT_MS', 30_000, 5_000, 180_000),
    selectorTimeoutMs: optInt('PUPPETEER_SELECTOR_TIMEOUT_MS', 15_000, 1_000, 120_000),
    operationTimeoutMs: optInt('PUPPETEER_OPERATION_TIMEOUT_MS', 120_000, 10_000, 600_000),
  },

  logging: {
    level: optStr('LOG_LEVEL', 'info'),
    dir: LOG_DIR,
    toFile: logDirRequested && LOG_DIR !== null,
    maxSizeBytes: optInt('LOG_MAX_SIZE_MB', 5, 1, 500) * 1024 * 1024,
    maxFiles: optInt('LOG_MAX_FILES', 3, 1, 50),
  },

  web: {
    enabled: optBool('WEB_ENABLED', true),
    port: optInt('PORT', 5176, 0, 65535),
    host: optStr('WEB_HOST', '0.0.0.0'),
    adminPassword: optStr('DASHBOARD_ADMIN_PASSWORD', optStr('WEB_ADMIN_PASSWORD', optStr('WEB_TOKEN', ''))),
    token: optStr('DASHBOARD_ADMIN_PASSWORD', optStr('WEB_ADMIN_PASSWORD', optStr('WEB_TOKEN', ''))),
    exposeMembers: optBool('WEB_EXPOSE_MEMBERS', true),
    staticDir: raw('WEB_STATIC_DIR') ? resolvePath(raw('WEB_STATIC_DIR') ?? '') : PUBLIC_DIR,
  },

  branding: {
    serverName: optStr('SERVER_NAME', 'Minecraft Server'),
    footer: optStr('SERVER_FOOTER', ''),
  },

  registration: {
    enabled: optBool('REGISTRATION_ENABLED', false),
  },

  timezone,
};

// ─── Cross-field checks ───────────────────────────────────────────────────────

if (
  config.permissions.ownerUserIds.length === 0 &&
  config.permissions.adminUserIds.length === 0 &&
  config.permissions.adminRoleIds.length === 0
) {
  warnings.push(
    'No OWNER_USER_IDS or ADMIN_USER_IDS/ADMIN_ROLE_IDS are set — nobody will be able to /stop or /restart the server.',
  );
}

if (config.browser.executablePath === undefined && (platform.isTermux || process.arch !== 'x64')) {
  warnings.push(
    `No system Chromium found on ${platform.kind}/${process.arch}. ` +
    "Puppeteer's bundled build is x64-only; install Chromium " +
    `(${platform.isTermux ? 'pkg install chromium' : 'apt install chromium'}) ` +
    'or set PUPPETEER_EXECUTABLE_PATH.',
  );
}

if (platform.isTermux && config.browser.headless && !process.env['DISPLAY']) {
  warnings.push(
    'Running headless on Termux. If Aternos blocks the session, install xvfb and ' +
    'launch with: xvfb-run -a npm start (with PUPPETEER_HEADLESS=false).',
  );
}

if (config.web.enabled) {
  const boundPublicly = config.web.host === '0.0.0.0' || config.web.host === '::';

  if (config.web.token === '') {
    warnings.push(
      boundPublicly
        ? 'WEB_TOKEN is not set while WEB_HOST binds every interface. The dashboard API ' +
        'can start and stop the server, so the write endpoints have been DISABLED. ' +
        'Set WEB_TOKEN to enable them.'
        : 'WEB_TOKEN is not set, so the dashboard API write endpoints are disabled. ' +
        'The UI will be read-only until a token is configured.',
    );
  }

  if (boundPublicly) {
    warnings.push(
      `The dashboard is bound to ${config.web.host}:${config.web.port} and reachable from ` +
      'the network. Put it behind a reverse proxy with TLS, or set WEB_HOST=127.0.0.1 ' +
      'and reach it over an SSH tunnel.',
    );
  }

  if (config.web.exposeMembers) {
    warnings.push(
      'WEB_EXPOSE_MEMBERS is enabled. This requires the privileged "Server Members Intent" ' +
      'to be switched on in the Discord Developer Portal, or the bot will fail to log in.',
    );
  }
}

if (remoteDebuggingPort > 0) {
  warnings.push(
    `Chromium remote debugging is enabled on 127.0.0.1:${remoteDebuggingPort}. ` +
    'Anyone with local access can take over the authenticated Aternos session. ' +
    'Disable it in production by unsetting PUPPETEER_REMOTE_DEBUGGING_PORT.',
  );
}

// ─── Report ───────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error('\n[FATAL] Configuration is invalid:\n');
  for (const message of errors) console.error(`  X ${message}`);
  console.error('\nCopy .env.example to .env and fill in the required values.\n');
  process.exit(1);
}

/** Warnings gathered during load; emitted through the logger once it exists. */
export const configWarnings: readonly string[] = warnings;
