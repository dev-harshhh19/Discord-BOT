import winston from 'winston';
import { config } from '../../config/env';

/** Indian Standard Time offset: UTC+5:30 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTTimestamp(): string {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return now.toISOString().replace('T', ' ').replace('Z', ' IST');
}

const { combine, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, stack }) => {
  const ts = getISTTimestamp();
  const msg = stack ? `${String(message)}\n${String(stack)}` : String(message);
  return `[${ts}] [${level.toUpperCase()}] ${msg}`;
});

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        logFormat,
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});
