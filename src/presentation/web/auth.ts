import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../../config/env';
import { logger } from '../../infrastructure/logger/WinstonLogger';

/**
 * Authentication and DDoS / Rate-Limiting Protection for the Dashboard API.
 */

/** Constant-time string comparison preventing timing attack leaks. */
export function timingSafeMatch(provided: unknown, expected: unknown): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Extracts authentication token from Bearer header or X-Auth-Token header. */
export function extractToken(req: Request): string | null {
  if (!req || typeof req.get !== 'function') return null;
  const authorization = req.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match?.[1]) return match[1].trim();
  }

  const headerToken = req.get('x-auth-token');
  if (headerToken && headerToken.trim() !== '') return headerToken.trim();

  return null;
}

/** True when a valid admin password has been configured in .env. */
export function isAuthConfigured(): boolean {
  return Boolean(config.web.adminPassword && config.web.adminPassword.trim() !== '');
}

/** Validates whether a given token (or request) matches the configured admin password. */
export function verifyAdminToken(tokenOrReq: string | Request | null | undefined): boolean {
  if (!isAuthConfigured() || !tokenOrReq) return false;
  const token = typeof tokenOrReq === 'object' && 'headers' in tokenOrReq
    ? extractToken(tokenOrReq)
    : (typeof tokenOrReq === 'string' ? tokenOrReq : null);
  if (!token) return false;
  return timingSafeMatch(token, config.web.adminPassword);
}

/**
 * Express middleware requiring an authenticated Admin session.
 */
export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthConfigured()) {
    res.status(503).json({
      success: false,
      error:
        'Admin actions are disabled because DASHBOARD_ADMIN_PASSWORD is not configured in .env.',
    });
    return;
  }

  const provided = extractToken(req);
  if (!provided) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please unlock Admin access with password.',
    });
    return;
  }

  if (!verifyAdminToken(provided)) {
    logger.warn(`Rejected unauthorized API request to ${req.path} from IP ${req.ip}`);
    res.status(403).json({ success: false, error: 'Invalid admin credentials.' });
    return;
  }

  next();
}

/**
 * Express middleware for optional auth checking.
 */
export function attachAuthRole(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  (req as Request & { isAdmin?: boolean }).isAdmin = verifyAdminToken(token);
  next();
}

export type Middleware = (req: Request, res: Response, next: NextFunction) => void;

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  message?: string;
  skipFailedRequests?: boolean;
}

/**
 * Sliding window IP rate limiter for DDoS and brute-force mitigation.
 */
export function createRateLimiter(options: RateLimitOptions | number, windowMs?: number): Middleware {
  const maxRequests = typeof options === 'number' ? options : options.maxRequests;
  const window = typeof options === 'number' ? (windowMs ?? 60_000) : options.windowMs;
  const message = typeof options === 'object' && options.message ? options.message : 'Too many requests. Please slow down.';

  const hits = new Map<string, number[]>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    // Accurately resolve real client IP across reverse proxies & Cloud Run
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : Array.isArray(forwarded) && forwarded[0]
        ? forwarded[0].split(',')[0].trim()
        : null;
    const key = forwardedIp || req.ip || req.socket.remoteAddress || 'unknown';

    // Never throttle local loopback probes or health tasks
    if (key === '127.0.0.1' || key === '::1' || key === '::ffff:127.0.0.1') {
      next();
      return;
    }

    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < window);

    // Give authenticated admins additional headroom
    const token = extractToken(req);
    const effectiveMax = verifyAdminToken(token) ? maxRequests * 2 : maxRequests;

    if (recent.length >= effectiveMax) {
      const oldest = recent[0] ?? now;
      const retryAfter = Math.max(1, Math.ceil((window - (now - oldest)) / 1000));
      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({
        success: false,
        error: `${message} Try again in ${retryAfter}s.`,
      });
      return;
    }

    recent.push(now);
    hits.set(key, recent);

    // Housekeeping to prevent memory leak
    if (hits.size > 2000) {
      for (const [k, timestamps] of hits) {
        if (timestamps.every((t) => now - t >= window)) {
          hits.delete(k);
        }
      }
    }

    next();
  };
}

// Pre-configured rate limiters
// Generous 600 req/min (10 req/s) for telemetry, status polling, and multi-tab dashboard use
export const ddosApiRateLimiter = createRateLimiter({
  maxRequests: 600,
  windowMs: 60_000,
  message: 'API request rate limit exceeded.',
});

export const authLoginRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
  message: 'Too many login attempts. Blocked for 60 seconds to protect against brute force.',
});

export const serverActionRateLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60_000,
  message: 'Server control rate limit reached. Please wait before issuing more server actions.',
});
