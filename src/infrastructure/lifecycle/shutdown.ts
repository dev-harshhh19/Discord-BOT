import { logger } from '../logger/WinstonLogger';

/**
 * Graceful shutdown coordination.
 *
 * Without this the process exited on SIGINT/SIGTERM (and on an uncaught
 * exception) while Chromium was still running. That orphans the browser process
 * and leaves a `SingletonLock` in the user-data directory, so the *next* start
 * fails to launch — the failure mode that most often strands a Termux
 * deployment after a crash or a phone reboot.
 */

type ShutdownHook = () => Promise<void> | void;

interface RegisteredHook {
  name: string;
  run: ShutdownHook;
}

const hooks: RegisteredHook[] = [];
let shuttingDown = false;

/** Registers cleanup to run before exit. Hooks run in reverse registration order. */
export function onShutdown(name: string, run: ShutdownHook): void {
  hooks.push({ name, run });
}

/** True once shutdown has begun, so long-running work can bail out early. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

/**
 * Runs every hook, then exits.
 *
 * A hard timeout guarantees the process dies even if a hook hangs — an
 * unresponsive browser must not prevent a restart.
 */
export async function shutdown(reason: string, exitCode = 0, timeoutMs = 15_000): Promise<never> {
  if (shuttingDown) {
    // A second signal means "stop waiting".
    logger.warn('Received a second shutdown request; exiting immediately.');
    process.exit(exitCode);
  }
  shuttingDown = true;

  logger.info(`Shutting down: ${reason}`);

  const forceExit = setTimeout(() => {
    logger.error(`Shutdown did not complete within ${timeoutMs}ms; forcing exit.`);
    process.exit(exitCode === 0 ? 1 : exitCode);
  }, timeoutMs);
  forceExit.unref();

  for (const hook of [...hooks].reverse()) {
    try {
      await hook.run();
      logger.debug(`Shutdown hook "${hook.name}" completed.`);
    } catch (err) {
      logger.warn(`Shutdown hook "${hook.name}" failed: ${String(err)}`);
    }
  }

  clearTimeout(forceExit);
  logger.info('Shutdown complete.');

  // Give the logger's transports a moment to flush before the process ends.
  await new Promise((resolve) => setTimeout(resolve, 100));
  process.exit(exitCode);
}

/** Wires the process signals and last-resort error handlers. */
export function installSignalHandlers(): void {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      void shutdown(`received ${signal}`, 0);
    });
  }

  process.on('unhandledRejection', (reason: unknown) => {
    // Logged, not fatal: a rejected Discord API call should not kill the bot.
    logger.error(`Unhandled promise rejection: ${String(reason)}`);
    if (reason instanceof Error && reason.stack) logger.debug(reason.stack);
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught exception: ${err.message}`);
    logger.error(err.stack ?? '(no stack)');
    // The process state is no longer trustworthy, but cleanup still runs so the
    // browser is closed and its profile lock released.
    void shutdown('uncaught exception', 1);
  });
}
