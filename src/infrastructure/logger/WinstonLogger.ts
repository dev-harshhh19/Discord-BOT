import path from 'node:path';
import winston from 'winston';
import { config } from '../../config/env';
import { configureTimezone, formatLogTimestamp } from '../../utils/time';
import { MemoryLogTransport } from '../../presentation/web/logCapture';

// Timestamps render in the configured zone rather than a hardcoded offset.
configureTimezone(config.timezone);

const { combine, printf, colorize, errors } = winston.format;

const lineFormat = printf((info) => {
  const { level, message, stack } = info as {
    level: string;
    message: unknown;
    stack?: unknown;
  };
  const text = typeof message === 'string' ? message : JSON.stringify(message);
  const body = stack ? `${text}\n${String(stack)}` : text;
  return `[${formatLogTimestamp()}] [${level.toUpperCase()}] ${body}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(errors({ stack: true }), colorize({ all: true }), lineFormat),
  }),
  // Ring buffer backing the dashboard's log view.
  new MemoryLogTransport(),
];

/**
 * File logging is optional and size-capped.
 *
 * The previous configuration wrote to `logs/` relative to the working directory
 * with no rotation, so the location depended on how the process was started and
 * the files grew without bound — a real problem on a phone or a small VPS.
 * `LOG_DIR` now resolves against the app root, and size and count are capped.
 */
if (config.logging.toFile && config.logging.dir !== null) {
  const dir = config.logging.dir;
  const fileFormat = combine(errors({ stack: true }), lineFormat);
  const rotation = {
    maxsize: config.logging.maxSizeBytes,
    maxFiles: config.logging.maxFiles,
    tailable: true,
  };

  transports.push(
    new winston.transports.File({
      filename: path.join(dir, 'error.log'),
      level: 'error',
      format: fileFormat,
      ...rotation,
    }),
    new winston.transports.File({
      filename: path.join(dir, 'combined.log'),
      format: fileFormat,
      ...rotation,
    }),
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(errors({ stack: true }), lineFormat),
  transports,
  // A logging failure must never terminate the bot.
  exitOnError: false,
});

/** Where logs are being written, for the startup banner. */
export function describeLogDestination(): string {
  if (!config.logging.toFile || config.logging.dir === null) return 'console only';
  return `console + ${config.logging.dir}`;
}
