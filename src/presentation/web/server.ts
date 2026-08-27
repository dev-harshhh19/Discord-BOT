import fs from 'node:fs';
import path from 'node:path';
import { Server } from 'node:http';
import express, { NextFunction, Request, Response } from 'express';
import { Client } from 'discord.js';
import { BotCommand, ServiceContainer } from '../../types';
import { config } from '../../config/env';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { createApiRouter } from './routes';
import { isAuthConfigured } from './auth';

/**
 * HTTP server hosting the health endpoint and the dashboard UI.
 *
 * Two behaviours worth noting:
 *  - It binds to `WEB_HOST` (loopback by default) rather than every interface.
 *  - A bind failure such as EADDRINUSE is reported and tolerated instead of
 *    crashing the process. The Discord bot is the primary function; losing the
 *    dashboard should not take it down.
 */
export function startWebServer(
  services: ServiceContainer,
  commands: Map<string, BotCommand>,
  client: Client,
): Promise<Server | null> {
  if (!config.web.enabled) {
    logger.info('Web server disabled (WEB_ENABLED=false).');
    return Promise.resolve(null);
  }

  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // The dashboard is same-origin; no third-party embedding or sniffing.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Open, because container and PaaS health probes cannot supply a token. It
  // deliberately exposes nothing beyond liveness and basic telemetry for trackers like Uptime Kuma.
  app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
    const ready = client.isReady();
    res.status(ready ? 200 : 503).json({
      status: ready ? 'UP' : 'STARTING',
      state: services.currentState,
      discord_latency_ms: client.ws.ping >= 0 ? client.ws.ping : null,
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', createApiRouter(services, commands, client));

  const staticDir = config.web.staticDir;
  const indexFile = path.join(staticDir, 'index.html');
  const hasUi = fs.existsSync(indexFile);

  if (hasUi) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));

    // Explicit routes for Discord Bot Verification (No JS required)
    const renderLegalPage = (title: string, content: string): string => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - ${config.branding.serverName}</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: auto; background: #0b0f17; color: #f8fafc; }
          h1 { color: #60a5fa; }
          h2 { color: #93c5fd; margin-top: 2rem; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${content}
      </body>
      </html>
    `;

    app.get(['/terms', '/terms-and-service', '/t&c'], (_req, res) => {
      res.send(renderLegalPage('Terms of Service', `
        <p>By using the ${config.branding.serverName} Bot & Dashboard, you agree to the following terms:</p>
        <h2>1. Use of Service</h2>
        <p>This service provides telemetry and management for our Minecraft server. Authorized administrators are granted access to execute power commands.</p>
        <h2>2. Acceptable Use</h2>
        <p>Do not abuse the bot commands, API endpoints, or dashboard features. All interactions must comply with Discord and Aternos Terms of Service.</p>
        <h2>3. Data & Privacy</h2>
        <p>For details on how we handle your Discord and Minecraft data, please review our Privacy Policy.</p>
      `));
    });

    app.get(['/privacy', '/privacy-policy'], (_req, res) => {
      res.send(renderLegalPage('Privacy Policy', `
        <p>Here is how we handle your data on the ${config.branding.serverName} Bot & Dashboard:</p>
        <h2>1. Information We Collect</h2>
        <p>We collect your Discord Member ID, username, server roles, and any Minecraft usernames you submit during whitelist registration.</p>
        <h2>2. How We Use Information</h2>
        <p>Your data is solely used to authenticate management commands, manage the Minecraft server whitelist, and provide live telemetry.</p>
        <h2>3. Data Security</h2>
        <p>We do not sell or trade your data. Telemetry logs (like IPs) are anonymized in logs. No third-party tracking or analytics cookies are used.</p>
      `));
    });

    // Single-page fallback for any non-API path.
    app.get(/^\/(?!api\/|health$).*/, (_req: Request, res: Response) => {
      res.sendFile(indexFile);
    });
  } else {
    logger.debug(`No dashboard UI found at ${staticDir}; serving the API only.`);
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(`Unhandled web error: ${err.message}`);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Internal server error.' });
  });

  return new Promise((resolve) => {
    const server = app.listen(config.web.port, config.web.host);

    server.once('listening', () => {
      const url = `http://${config.web.host}:${config.web.port}`;
      logger.info(
        `Web server listening on ${url} ` +
          `(${hasUi ? 'dashboard + API' : 'API only'}, ` +
          `${isAuthConfigured() ? 'admin password auth configured' : 'ADMIN ACTIONS DISABLED — no DASHBOARD_ADMIN_PASSWORD'})`,
      );
      resolve(server);
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(
          `Port ${config.web.port} is already in use. Another instance may be running. ` +
            'Set PORT to a free port, or WEB_ENABLED=false to skip the web server.',
        );
      } else if (err.code === 'EACCES') {
        logger.error(
          `Permission denied binding port ${config.web.port}. ` +
            'Ports below 1024 need elevated privileges; use a higher port.',
        );
      } else {
        logger.error(`Web server failed to start: ${err.message}`);
      }
      // Continue without the dashboard rather than aborting the bot.
      resolve(null);
    });
  });
}
