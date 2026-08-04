/**
 * A minimal FIFO async mutex.
 *
 * The Aternos service drives a single Puppeteer `Page`. Puppeteer offers no
 * concurrency guarantees on a shared page: if the background poller is reading
 * the status label while a Discord button handler triggers a navigation, the
 * poller's evaluation context is destroyed mid-call. That produced the
 * "Execution context was destroyed" / "frame detached" errors the service was
 * previously papering over with retries. Serialising every page operation
 * removes the race at the source.
 */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();
  private depth = 0;

  /** Number of operations queued or running. */
  get pending(): number {
    return this.depth;
  }

  /**
   * Runs `fn` once all previously queued work has settled.
   *
   * @param timeoutMs Optional ceiling. On expiry the caller's promise rejects,
   *   but the queue is not corrupted — the underlying operation still runs to
   *   completion before the next waiter starts, so the page is never touched by
   *   two operations at once.
   */
  async runExclusive<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    this.depth++;

    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      if (timeoutMs === undefined || timeoutMs <= 0) {
        return await fn();
      }
      return await withTimeout(fn(), timeoutMs);
    } finally {
      this.depth--;
      release();
    }
  }
}

export class OperationTimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'OperationTimeoutError';
  }
}

/** Rejects with `OperationTimeoutError` if `promise` has not settled in time. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new OperationTimeoutError(ms)), ms);
    // Do not hold the event loop open purely for this timer.
    if (typeof timer.unref === 'function') timer.unref();
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  }) as Promise<T>;
}
