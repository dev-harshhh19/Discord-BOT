import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Filesystem layout resolution.
 *
 * Every writable path used by the bot is resolved here — never relative to
 * `process.cwd()`. Relying on the CWD breaks the moment the process is started
 * by systemd, pm2, a cron entry, or a Termux `~/.bashrc` hook, because those all
 * launch the process from a directory that is not the project root.
 *
 * Resolution order for each directory:
 *   1. Explicit env override (`DATA_DIR` / `LOG_DIR` / `SESSION_DIR`)
 *   2. `<app root>/<default>`
 *   3. `<os.tmpdir()>/aternos-manager/<default>` if the app root is read-only
 */

/** Absolute path of the project root (the directory containing package.json). */
export const APP_ROOT = findAppRoot();

function findAppRoot(): string {
  // __dirname is <root>/src/config in dev (tsx) and <root>/dist in a build.
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Expands a leading `~` and resolves the result against the app root. */
export function resolvePath(input: string, base: string = APP_ROOT): string {
  let p = input.trim();
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(base, p);
}

/**
 * Creates `dir` if needed and verifies it is writable.
 * Returns the usable path, or `null` when neither the requested directory nor
 * the temp-dir fallback can be created (e.g. a read-only container filesystem).
 */
export function ensureWritableDir(dir: string, fallbackName?: string): string | null {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return dir;
  } catch {
    if (!fallbackName) return null;
    try {
      const fallback = path.join(os.tmpdir(), 'aternos-manager', fallbackName);
      fs.mkdirSync(fallback, { recursive: true });
      fs.accessSync(fallback, fs.constants.W_OK);
      return fallback;
    } catch {
      return null;
    }
  }
}

function dirFromEnv(envKey: string, defaultRelative: string): string {
  const override = process.env[envKey];
  if (override && override.trim() !== '') return resolvePath(override);
  return path.join(APP_ROOT, defaultRelative);
}

/** Root for all persistent runtime state. */
export const DATA_DIR = dirFromEnv('DATA_DIR', 'data');

/** Winston file-transport directory. `null` disables file logging. */
export const LOG_DIR = ensureWritableDir(dirFromEnv('LOG_DIR', 'logs'), 'logs');

/**
 * Chromium `userDataDir`. Kept under DATA_DIR by default so a single
 * `DATA_DIR=/var/lib/aternos-bot` relocates every stateful file at once.
 */
export const SESSION_DIR =
  ensureWritableDir(
    process.env['SESSION_DIR'] && process.env['SESSION_DIR'].trim() !== ''
      ? resolvePath(process.env['SESSION_DIR'])
      : path.join(DATA_DIR, 'browser-session'),
    'browser-session',
  ) ?? path.join(os.tmpdir(), 'aternos-manager-session');

/** Lock file used to detect a second instance sharing the same session dir. */
export const INSTANCE_LOCK_FILE = path.join(SESSION_DIR, '.bot-instance.lock');

/**
 * Static assets for the web dashboard.
 *
 * Anchored to the app root rather than `process.cwd()`, so the UI still loads
 * when the process is started from somewhere else (systemd, pm2, a cron job).
 */
export const PUBLIC_DIR = path.join(APP_ROOT, 'public');
