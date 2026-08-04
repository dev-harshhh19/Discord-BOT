import Transport from 'winston-transport';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  message: string;
}

// Matches ANSI color codes (ESC + "[" + digits + "m") so they can be stripped
// from captured log lines. Built from a char code so no raw control byte or
// control-character escape has to appear in the source.
const ANSI_CODES = new RegExp(String.fromCharCode(0x1b) + '\\[\\d+m', 'g');

const MAX_LOGS = 200;
const logBuffer: LogEntry[] = [];
let logCounter = 0;

export class MemoryLogTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  override log(info: Record<string, unknown>, next: () => void): void {
    const message = info['message'] ? String(info['message']) : '';
    const level = info['level'] ? String(info['level']).toLowerCase() : 'info';
    const entry: LogEntry = {
      id: ++logCounter,
      timestamp: new Date().toISOString(),
      level: level.replace(ANSI_CODES, ''),
      message: message.replace(ANSI_CODES, ''),
    };

    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift();
    }

    next();
  }
}

export function getRecentLogs(limit = 100): LogEntry[] {
  return logBuffer.slice(-limit);
}
