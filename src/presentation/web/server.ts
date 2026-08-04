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
  // deliberately exposes nothing beyond liveness.
  app.get('/health', (_req: Request, res: Response) => {
    const ready = client.isReady();
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'starting',
      state: services.currentState,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', createApiRouter(services, commands, client));

  const staticDir = config.web.staticDir;
  const indexFile = path.join(staticDir, 'index.html');
  const hasUi = fs.existsSync(indexFile);

  if (hasUi) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
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
