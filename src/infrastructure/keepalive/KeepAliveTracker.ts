import http from 'node:http';
import { Request } from 'express';
import { logger } from '../logger/WinstonLogger';
import { config } from '../../config/env';

export interface PingRecord {
  id: string;
  timestamp: string;
  path: string;
  method: string;
  source: string;
  ip: string;
  userAgent: string;
  responseTimeMs: number;
  status: number;
}

export interface SelfPingerConfig {
  enabled: boolean;
  intervalMinutes: number;
}

export interface SelfPingerStatus {
  enabled: boolean;
  intervalMinutes: number;
  totalSelfPings: number;
  lastSelfPingAt: string | null;
  lastSelfPingStatus: 'success' | 'failed' | null;
  lastSelfPingLatencyMs: number | null;
  nextScheduledPingInSeconds: number;
}

export interface KeepAliveStats {
  totalPings: number;
  lastPingAt: string | null;
  lastPingSource: {
    ip: string;
    userAgent: string;
    method: string;
    path: string;
  } | null;
  recentPings: PingRecord[];
  selfPinger: SelfPingerStatus;
}

/**
 * Tracks incoming 24/7 health pings from external monitors (UptimeRobot, Cron-job, BetterStack, etc.)
 * and provides an automatic internal self-pinger to prevent cloud hosts from idling or sleeping.
 */
export class KeepAliveTracker {
  private totalPings = 0;
  private lastPingAt: string | null = null;
  private lastPingSource: {
    ip: string;
    userAgent: string;
    method: string;
    path: string;
  } | null = null;

  private recentPings: PingRecord[] = [];
  private maxRecentPings = 30;

  // Self-pinger state: disabled by default so the app does not boom itself internally.
  // External monitors like cron-job.org and UptimeMonitor handle 24/7 keep-alive probes.
  private selfPingEnabled = false;
  private selfPingIntervalMinutes = 5;
  private totalSelfPings = 0;
  private lastSelfPingAt: string | null = null;
  private lastSelfPingStatus: 'success' | 'failed' | null = null;
  private lastSelfPingLatencyMs: number | null = null;
  private nextScheduledPingTimestamp = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    // Explicitly do not start internal self-pinger. We let external monitors
    // (cron-job.org and UptimeMonitor) request the health endpoints from outside.
  }

  public recordPing(req: Request, responseTimeMs: number, status = 200): void {
    this.totalPings++;
    const now = new Date().toISOString();
    this.lastPingAt = now;

    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ip = sanitizeIp(rawIp);
    const userAgent = req.get('user-agent') || 'Unknown Monitor';
    const method = req.method || 'GET';
    const path = req.originalUrl || req.path || '/health';

    let source = 'External Monitor';
    const ua = userAgent.toLowerCase();
    if (ua.includes('cron-job') || ua.includes('cronjob')) {
      source = 'cron-job.org';
    } else if (ua.includes('uptimemonitor') || ua.includes('uptime-monitor')) {
      source = 'UptimeMonitor';
    } else if (ua.includes('uptimerobot')) {
      source = 'UptimeRobot';
    } else if (ua.includes('betterstack') || ua.includes('uptime-kuma')) {
      source = 'BetterStack / Uptime Kuma';
    } else if (ua.includes('curl')) {
      source = 'cURL CLI Probe';
    } else if (ua.includes('pingdom')) {
      source = 'Pingdom';
    } else if (ua.includes('statuscake') || ua.includes('freshping')) {
      source = 'StatusCake / Freshping';
    } else if (ua.includes('manual-test') || ua.includes('dashboard-test')) {
      source = 'Manual Dashboard Test';
    } else if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')) {
      source = 'Web Browser Client';
    } else {
      source = 'External Monitor';
    }

    this.lastPingSource = { ip, userAgent, method, path };

    const record: PingRecord = {
      id: Math.random().toString(36).substring(2, 10),
      timestamp: now,
      path,
      method,
      source,
      ip,
      userAgent: userAgent.substring(0, 120),
      responseTimeMs: Math.max(1, Math.round(responseTimeMs)),
      status,
    };

    this.recentPings.unshift(record);
    if (this.recentPings.length > this.maxRecentPings) {
      this.recentPings.pop();
    }
  }

  public getStats(): KeepAliveStats {
    const nextInSec = Math.max(0, Math.round((this.nextScheduledPingTimestamp - Date.now()) / 1000));
    return {
      totalPings: this.totalPings,
      lastPingAt: this.lastPingAt,
      lastPingSource: this.lastPingSource,
      recentPings: [...this.recentPings],
      selfPinger: {
        enabled: this.selfPingEnabled,
        intervalMinutes: this.selfPingIntervalMinutes,
        totalSelfPings: this.totalSelfPings,
        lastSelfPingAt: this.lastSelfPingAt,
        lastSelfPingStatus: this.lastSelfPingStatus,
        lastSelfPingLatencyMs: this.lastSelfPingLatencyMs,
        nextScheduledPingInSeconds: nextInSec,
      },
    };
  }

  public configureSelfPinger(cfg: { enabled?: boolean; intervalMinutes?: number }): void {
    if (typeof cfg.enabled === 'boolean') {
      this.selfPingEnabled = cfg.enabled;
    }
    if (typeof cfg.intervalMinutes === 'number' && cfg.intervalMinutes >= 1 && cfg.intervalMinutes <= 60) {
      this.selfPingIntervalMinutes = cfg.intervalMinutes;
    }

    this.startSelfPinger();
  }

  public async triggerManualSelfPing(): Promise<{ success: boolean; latencyMs: number; status: number; error?: string }> {
    return this.executeSelfPing();
  }

  private startSelfPinger(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (!this.selfPingEnabled) {
      return;
    }

    const intervalMs = this.selfPingIntervalMinutes * 60 * 1000;
    this.nextScheduledPingTimestamp = Date.now() + intervalMs;

    this.timer = setInterval(() => {
      void this.executeSelfPing();
      this.nextScheduledPingTimestamp = Date.now() + intervalMs;
    }, intervalMs);
  }

  private executeSelfPing(): Promise<{ success: boolean; latencyMs: number; status: number; error?: string }> {
    return new Promise((resolve) => {
      const port = config.web.port || 3000;
      const host = '127.0.0.1';
      const start = Date.now();

      const req = http.request(
        {
          hostname: host,
          port,
          path: '/api/health',
          method: 'GET',
          headers: {
            'User-Agent': 'TomMC-KeepAlive-Internal/2.0 (Keep-Alive Self-Pinger)',
            'Accept': 'application/json',
          },
          timeout: 8000,
        },
        (res) => {
          res.resume();
          res.on('end', () => {
            const latency = Date.now() - start;
            this.totalSelfPings++;
            this.lastSelfPingAt = new Date().toISOString();
            this.lastSelfPingStatus = res.statusCode === 200 ? 'success' : 'failed';
            this.lastSelfPingLatencyMs = latency;
            resolve({ success: res.statusCode === 200, latencyMs: latency, status: res.statusCode || 200 });
          });
        },
      );

      req.on('error', (err) => {
        const latency = Date.now() - start;
        this.totalSelfPings++;
        this.lastSelfPingAt = new Date().toISOString();
        this.lastSelfPingStatus = 'failed';
        this.lastSelfPingLatencyMs = latency;
        logger.debug(`Internal self-ping probe notice: ${err.message}`);
        resolve({ success: false, latencyMs: latency, status: 0, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        this.lastSelfPingStatus = 'failed';
        resolve({ success: false, latencyMs: Date.now() - start, status: 408, error: 'Timeout' });
      });

      req.end();
    });
  }
}

function sanitizeIp(ip: string): string {
  if (ip === '::1' || ip === '127.0.0.1') return '127.0.0.1 (Local)';
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  return ip;
}

export const keepAliveTracker = new KeepAliveTracker();
