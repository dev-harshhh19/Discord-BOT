/** Base class for every error the bot raises deliberately. */
export class BotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** A failure driving the Aternos web panel. */
export class AternosError extends BotError {}

/** A failure querying the Minecraft server over the status protocol. */
export class MinecraftQueryError extends BotError {
  /**
   * True while the failure count is still under the debounce threshold, i.e.
   * "this ping failed, but not enough times to call the server offline".
   *
   * Previously callers detected this by matching on the message text
   * (`err.message.includes('awaiting threshold')`), which silently breaks the
   * moment the wording changes. It is a typed property now.
   */
  readonly belowThreshold: boolean;

  constructor(message: string, belowThreshold = false) {
    super(message);
    this.belowThreshold = belowThreshold;
  }
}

/** A caller lacked the required permission level. */
export class PermissionError extends BotError {}

/** Type guard for the debounce case above. */
export function isBelowFailureThreshold(err: unknown): boolean {
  return err instanceof MinecraftQueryError && err.belowThreshold;
}
