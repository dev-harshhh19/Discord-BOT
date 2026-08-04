import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ensureWritableDir } from '../../config/paths';
import { logger } from '../logger/WinstonLogger';

/** One self-service registration, keyed by Discord user id. */
export interface Registration {
  /** The user's tag at the time of registration, for human-readable audits. */
  tag: string;
  /** Optional Minecraft in-game username (IGN). */
  playerName?: string;
  /** ISO-8601 timestamp of when the registration happened. */
  registeredAt: string;
}

interface StoreFile {
  version: 1;
  registrations: Record<string, Registration>;
}

/**
 * Persistent store for self-registered (whitelisted) users.
 *
 * Registered users are treated as Trusted by the permission resolver, so a
 * registration made today still applies to every future launch without any
 * change to the environment configuration.
 *
 * Storage is a single JSON file under DATA_DIR — the same root that already
 * holds the browser session — so one `DATA_DIR` override relocates all state
 * together. Writes go through a temp file + rename so a crash mid-write cannot
 * truncate the registry.
 */
export class RegistrationStore {
  private readonly filePath: string | null;
  private registrations = new Map<string, Registration>();

  constructor(filePath: string | null = defaultStorePath()) {
    this.filePath = filePath;
    this.load();
  }

  /** True when the user has registered themselves. */
  has(userId: string): boolean {
    return this.registrations.has(userId);
  }

  get(userId: string): Registration | undefined {
    return this.registrations.get(userId);
  }

  getAll(): Map<string, Registration> {
    return new Map(this.registrations);
  }

  getAllEntries(): [string, Registration][] {
    return Array.from(this.registrations.entries());
  }

  get count(): number {
    return this.registrations.size;
  }

  /**
   * Registers a user or updates their Minecraft IGN.
   * Returns an object describing whether it's a new registration or an update.
   */
  register(userId: string, tag: string, playerName?: string): { isNew: boolean; updated: boolean } {
    const existing = this.registrations.get(userId);
    const cleanPlayerName = playerName?.trim() || undefined;

    if (!existing) {
      this.registrations.set(userId, {
        tag,
        playerName: cleanPlayerName,
        registeredAt: new Date().toISOString(),
      });
      this.save();
      return { isNew: true, updated: false };
    }

    if (cleanPlayerName && existing.playerName !== cleanPlayerName) {
      existing.playerName = cleanPlayerName;
      existing.tag = tag;
      this.save();
      return { isNew: false, updated: true };
    }

    return { isNew: false, updated: false };
  }

  /** Removes a registration. Returns whether one existed. */
  unregister(userId: string): boolean {
    const removed = this.registrations.delete(userId);
    if (removed) this.save();
    return removed;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private load(): void {
    if (this.filePath === null || !fs.existsSync(this.filePath)) return;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as StoreFile;
      this.registrations = new Map(Object.entries(parsed.registrations ?? {}));
      logger.info(
        `Loaded ${this.registrations.size} registered user` +
          `${this.registrations.size === 1 ? '' : 's'} from ${this.filePath}.`,
      );
    } catch (err) {
      // A corrupt registry must not take the bot down; start empty but keep
      // the broken file for inspection instead of overwriting it blindly.
      logger.error(`Could not read the registration store at ${this.filePath}: ${String(err)}`);
      try {
        fs.copyFileSync(this.filePath, `${this.filePath}.corrupt`);
        logger.warn(`The unreadable registry was copied to ${this.filePath}.corrupt.`);
      } catch {
        // Best effort only.
      }
    }
  }

  private save(): void {
    if (this.filePath === null) {
      logger.warn('The registration store has no writable location; changes are in-memory only.');
      return;
    }

    const body: StoreFile = {
      version: 1,
      registrations: Object.fromEntries(this.registrations),
    };

    try {
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      logger.error(`Could not persist the registration store: ${String(err)}`);
    }
  }
}

function defaultStorePath(): string | null {
  const dir = ensureWritableDir(DATA_DIR, 'data');
  return dir === null ? null : path.join(dir, 'registrations.json');
}

/**
 * The process-wide store instance.
 *
 * A singleton (like `logger`) rather than a container entry because the
 * permission resolver — plain functions called from every interaction — needs
 * it without threading the container through each call site.
 */
export const registrationStore = new RegistrationStore();
