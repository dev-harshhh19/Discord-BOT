import dotenv from 'dotenv';

dotenv.config({ override: true });

interface EnvConfig {
  DISCORD_BOT_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_GUILD_ID: string;
  CONTROL_CHANNEL_ID: string;
  ATERNOS_USERNAME: string;
  ATERNOS_PASSWORD: string;
  ATERNOS_SESSION?: string;
  ATERNOS_SERVER_URL: string;
  MC_SERVER_ADDRESS: string;
  MC_SERVER_PORT: number;
  OWNER_USER_IDS: string[];
  ADMIN_USER_IDS: string[];
  ADMIN_ROLE_IDS: string[];
  TRUSTED_USER_IDS: string[];
  TRUSTED_ROLE_IDS: string[];
  POLL_INTERVAL_SECONDS: number;
  LOG_LEVEL: string;
  PUPPETEER_HEADLESS: boolean;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    console.error(`[FATAL] Please copy .env.example to .env and fill in all values.`);
    process.exit(1);
  }
  return value.trim();
}

function optionalEnvList(key: string): string[] {
  const value = process.env[key];
  if (!value || value.trim() === '') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function requireEnvInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    console.error(`[FATAL] Environment variable ${key} must be a valid integer, got: "${raw}"`);
    process.exit(1);
  }
  return parsed;
}

export const config: EnvConfig = {
  DISCORD_BOT_TOKEN: requireEnv('DISCORD_BOT_TOKEN'),
  DISCORD_CLIENT_ID: requireEnv('DISCORD_CLIENT_ID'),
  DISCORD_GUILD_ID: requireEnv('DISCORD_GUILD_ID'),
  CONTROL_CHANNEL_ID: requireEnv('CONTROL_CHANNEL_ID'),
  ATERNOS_USERNAME: requireEnv('ATERNOS_USERNAME'),
  ATERNOS_PASSWORD: requireEnv('ATERNOS_PASSWORD'),
  ATERNOS_SESSION: process.env['ATERNOS_SESSION'],
  ATERNOS_SERVER_URL: requireEnv('ATERNOS_SERVER_URL'),
  MC_SERVER_ADDRESS: requireEnv('MC_SERVER_ADDRESS'),
  MC_SERVER_PORT: requireEnvInt('MC_SERVER_PORT', 58844),
  OWNER_USER_IDS: optionalEnvList('OWNER_USER_IDS'),
  ADMIN_USER_IDS: optionalEnvList('ADMIN_USER_IDS'),
  ADMIN_ROLE_IDS: optionalEnvList('ADMIN_ROLE_IDS'),
  TRUSTED_USER_IDS: optionalEnvList('TRUSTED_USER_IDS'),
  TRUSTED_ROLE_IDS: optionalEnvList('TRUSTED_ROLE_IDS'),
  POLL_INTERVAL_SECONDS: requireEnvInt('POLL_INTERVAL_SECONDS', 45),
  LOG_LEVEL: process.env['LOG_LEVEL'] ?? 'info',
  PUPPETEER_HEADLESS: process.env['PUPPETEER_HEADLESS'] === 'false' ? false : true,
};
