import { Router, Request, Response } from 'express';
import { Client, GuildMember } from 'discord.js';
import { ServiceContainer, ServerState, BotCommand, PermissionLevel } from '../../types';
import { config } from '../../config/env';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { formatUptime, sleep } from '../../utils/time';
import { getUserPermissionLevel, permissionLevelName } from '../../utils/permissions';
import { registrationStore } from '../../infrastructure/registration/RegistrationStore';
import { getRecentLogs } from './logCapture';
import {
  authLoginRateLimiter,
  ddosApiRateLimiter,
  serverActionRateLimiter,
  requireAdminToken,
  attachAuthRole,
  verifyAdminToken,
  isAuthConfigured,
  extractToken,
  timingSafeMatch,
} from './auth';
import { describePlatform } from '../../config/platform';
import { keepAliveTracker } from '../../infrastructure/keepalive/KeepAliveTracker';

/**
 * Dashboard REST API Router with Layered Rate Limiting and Role-Based Access Control.
 */
export function createApiRouter(
  services: ServiceContainer,
  commands: Map<string, BotCommand>,
  client: Client,
): Router {
  const router = Router();

  // Apply DDoS protection across all API routes
  router.use(ddosApiRateLimiter);
  router.use(attachAuthRole);

  // ─── POST /api/auth/login ───────────────────────────────────────────────────
  router.post('/auth/login', authLoginRateLimiter, (req: Request, res: Response) => {
    try {
      if (!isAuthConfigured()) {
        res.status(503).json({
          success: false,
          error: 'Authentication is not configured on the server (DASHBOARD_ADMIN_PASSWORD is missing).',
        });
        return;
      }

      const body = req.body as Record<string, unknown> | undefined;
      const password = typeof body?.password === 'string' ? body.password : undefined;
      if (!password) {
        res.status(400).json({ success: false, error: 'Password is required.' });
        return;
      }

      if (timingSafeMatch(password.trim(), config.web.adminPassword)) {
        logger.info(`Admin successfully authenticated from IP ${req.ip}`);
        res.status(200).json({
          success: true,
          token: config.web.adminPassword,
          role: 'admin',
          message: 'Admin access granted.',
        });
      } else {
        logger.warn(`Failed admin login attempt from IP ${req.ip}`);
        res.status(401).json({ success: false, error: 'Invalid admin password.' });
      }
    } catch (err) {
      fail(res, '/auth/login', err);
    }
  });

  // ─── GET /api/auth/check ────────────────────────────────────────────────────
  router.get('/auth/check', (req: Request, res: Response) => {
    const token = extractToken(req);
    const isAdmin = verifyAdminToken(token);
    res.status(200).json({
      success: true,
      authenticated: isAdmin,
      role: isAdmin ? 'admin' : 'guest',
      authConfigured: isAuthConfigured(),
    });
  });

  // ─── GET /api/status (Public + Admin Details) ────────────────────────────────
  router.get('/status', (req: Request, res: Response) => {
    try {
      const memoryUsage = process.memoryUsage();
      const livePing = services.lastMinecraftStatus;
      const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin;

      res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        role: isAdmin ? 'admin' : 'guest',
        server: {
          name: config.branding.serverName,
          state: services.currentState,
          address: config.minecraft.address,
          port: config.minecraft.port,
          onlineAt: services.serverOnlineAt?.toISOString() ?? null,
          uptimeFormatted: services.serverOnlineAt ? formatUptime(services.serverOnlineAt) : null,
          software: livePing?.software ?? config.minecraft.software,
          version: livePing?.version ?? config.minecraft.version,
          ram: config.minecraft.ram,
          region: config.minecraft.region,
          latency: livePing?.latency ?? null,
          players: {
            online: livePing?.players.online ?? 0,
            max: livePing?.players.max ?? 0,
            list: livePing?.players.list ?? [],
          },
        },
        bot: {
          name: config.branding.serverName,
          ready: client.isReady(),
          ping: client.ws.ping,
          browserReady: services.aternos.isReady?.() ?? null,
          user: client.user
            ? {
              id: client.user.id,
              username: client.user.username,
              tag: client.user.tag,
              avatar: client.user.displayAvatarURL(),
            }
            : null,
          uptimeSeconds: Math.floor((client.uptime ?? 0) / 1000),
          processUptimeSeconds: Math.floor(process.uptime()),
          guildsCount: client.guilds.cache.size,
          channelsCount: client.channels.cache.size,
          nodeVersion: process.version,
          platform: describePlatform(),
          arch: process.arch,
          memory: {
            heapUsedMB: round1(memoryUsage.heapUsed),
            heapTotalMB: round1(memoryUsage.heapTotal),
            rssMB: round1(memoryUsage.rss),
          },
        },
      });
    } catch (err) {
      fail(res, '/status', err);
    }
  });

  // ─── GET /api/dev (About Developer Profile) ─────────────────────────────────
  router.get('/dev', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      developer: {
        name: 'Harshad Nikam',
        username: 'dev-harshhh19',
        avatar: 'https://cdn.harshadnikam.me/Profile.png',
        title: 'Full Stack & Systems Architect',
        bio: 'Passionate developer building high-performance Discord bots, automation architectures, and modern web applications.',
        website: 'https://harshadnikam.me',
        github: 'https://github.com/dev-harshhh19',
        githubUsername: 'dev-harshhh19',
        portfolioUrl: 'https://harshadnikam.me',
        techStack: [
          'TypeScript',
          'Node.js',
          'Discord.js',
          'Puppeteer',
          'Express',
          'Modern CSS / UI Components',
          'Minecraft Protocol (Craftping)',
          'Docker',
        ],
        botProject: {
          name: 'TomMC-SMP Bot',
          description: 'Automated Aternos Minecraft server manager & Discord control hub with secure web telemetry.',
          version: '1.0.0',
        },
      },
    });
  });

  // ─── GET /api/keepalive (24/7 Keep-Alive & Health Engine Status) ────────────
  router.get('/keepalive', (_req: Request, res: Response) => {
    try {
      const ready = client.isReady();
      const uptimeSec = Math.floor(process.uptime());
      const stats = keepAliveTracker.getStats();
      const memoryUsage = process.memoryUsage();

      res.status(200).json({
        success: true,
        status: ready ? 'UP' : 'STANDBY',
        operational: true,
        message: 'TomMC-SMP Keep-Alive engine active 24/7',
        service: config.branding.serverName,
        serverState: services.currentState,
        botReady: ready,
        botPing: client.ws.ping >= 0 ? client.ws.ping : null,
        uptimeSeconds: uptimeSec,
        uptimeFormatted: formatUptime(new Date(Date.now() - uptimeSec * 1000)),
        memory: {
          rssMB: round1(memoryUsage.rss),
          heapUsedMB: round1(memoryUsage.heapUsed),
          heapTotalMB: round1(memoryUsage.heapTotal),
        },
        endpoints: [
          { path: '/api/health', method: 'GET / HEAD', type: 'Primary Health & Telemetry Probe' },
          { path: '/health', method: 'GET / HEAD', type: 'Container / PaaS Default Probe' },
          { path: '/healthz', method: 'GET / HEAD', type: 'Kubernetes / Cloud Standard Probe' },
          { path: '/ping', method: 'GET / HEAD', type: 'Lightweight Ping Endpoint' },
          { path: '/api/ping', method: 'GET / HEAD', type: 'API Ping Endpoint' },
          { path: '/livez', method: 'GET / HEAD', type: 'Liveness Check Endpoint' },
        ],
        stats: {
          totalPings: stats.totalPings,
          lastPingAt: stats.lastPingAt,
          lastPingSource: stats.lastPingSource,
        },
        selfPinger: stats.selfPinger,
        recentPings: stats.recentPings,
        guides: [
          {
            name: 'UptimeRobot',
            url: 'https://uptimerobot.com',
            monitorType: 'HTTP(s)',
            recommendedInterval: '5 minutes',
            tip: 'Select HTTP(s) monitor type, paste your /api/health URL, and set interval to 5 minutes to keep the host alive 24/7.',
          },
          {
            name: 'Cron-job.org',
            url: 'https://cron-job.org',
            monitorType: 'Webcron / URL Request',
            recommendedInterval: '5 or 10 minutes',
            tip: 'Free scheduled web cron that executes a GET request against your /api/health URL 24 hours a day.',
          },
          {
            name: 'BetterStack (Better Uptime)',
            url: 'https://betterstack.com',
            monitorType: 'Uptime Probe',
            recommendedInterval: '3 minutes',
            tip: 'Modern uptime tracking with push incident alerts and latency analytics.',
          },
        ],
      });
    } catch (err) {
      fail(res, '/keepalive', err);
    }
  });

  // ─── POST /api/keepalive/ping (Trigger an on-demand test ping) ───────────────
  router.post('/keepalive/ping', (_req: Request, res: Response) => {
    void (async (): Promise<void> => {
      try {
        const start = Date.now();
        const selfPingRes = await keepAliveTracker.triggerManualSelfPing();
        const ready = client.isReady();
        const memoryUsage = process.memoryUsage();
        const uptimeSec = Math.floor(process.uptime());
        const stats = keepAliveTracker.getStats();

        res.status(200).json({
          success: true,
          latencyMs: selfPingRes.latencyMs || (Date.now() - start),
          timestamp: new Date().toISOString(),
          probeResult: {
            status: ready ? 'UP' : 'STANDBY',
            operational: true,
            botReady: ready,
            state: services.currentState,
            uptimeSeconds: uptimeSec,
            memoryMB: Math.round(memoryUsage.rss / 1024 / 1024),
            selfPingStatus: selfPingRes.status,
          },
          stats: {
            totalPings: stats.totalPings,
            lastPingAt: stats.lastPingAt,
            selfPinger: stats.selfPinger,
          },
        });
      } catch (err) {
        fail(res, '/keepalive/ping', err);
      }
    })();
  });

  // ─── POST /api/keepalive/config (Update Self-Pinger settings) ────────────────
  router.post('/keepalive/config', (req: Request, res: Response) => {
    try {
      const body = req.body as { enabled?: boolean; intervalMinutes?: number };
      keepAliveTracker.configureSelfPinger({
        enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
        intervalMinutes: typeof body?.intervalMinutes === 'number' ? body.intervalMinutes : undefined,
      });

      res.status(200).json({
        success: true,
        message: 'Keep-alive self-pinger configuration updated successfully.',
        selfPinger: keepAliveTracker.getStats().selfPinger,
      });
    } catch (err) {
      fail(res, '/keepalive/config', err);
    }
  });

  // ─── GET /api/members (Admin or configured) ─────────────────────────────────
  router.get('/members', (_req: Request, res: Response) => {
    void (async (): Promise<void> => {
      try {
        if (!config.web.exposeMembers) {
          res.status(403).json({
            success: false,
            error: 'Member listing is disabled in configuration.',
          });
          return;
        }

        const guildId = config.discord.guildId ?? client.guilds.cache.first()?.id;
        let guild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();

        if (!guild && guildId) {
          guild = await client.guilds.fetch(guildId).catch(() => undefined);
        }
        if (!guild) {
          guild = client.guilds.cache.first();
        }

        if (!guild) {
          res.status(200).json({
            success: true,
            guild: {
              id: config.discord.guildId || 'N/A',
              name: 'TomMC-SMP Community',
              icon: null,
              memberCount: 0,
              channelsCount: 0,
              rolesCount: 0,
            },
            members: [],
            notice: client.isReady() ? 'Configured Discord Guild is active.' : 'Discord client connecting...',
          });
          return;
        }

        let members = guild.members.cache;
        if (members.size <= 1) {
          try {
            members = await guild.members.fetch();
          } catch {
            members = guild.members.cache;
          }
        }

        const livePing = services.lastMinecraftStatus;
        const registeredMap = registrationStore.getAll();

        const membersList = Array.from(members.values()).map((m: GuildMember) => {
          const level = getUserPermissionLevel(m, m.user.id);
          const reg = registeredMap.get(m.user.id);
          return {
            id: m.user.id,
            username: m.user.username,
            displayName: m.displayName,
            avatar: m.user.displayAvatarURL(),
            isBot: m.user.bot,
            joinedAt: m.joinedAt?.toISOString() ?? null,
            minecraftPlayerName: reg?.playerName || null,
            isRegistered: !!reg,
            roles: m.roles.cache
              .filter((r) => r.name !== '@everyone')
              .map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
            permissionLevel: level,
            permissionName: permissionLevelName(level),
          };
        });

        // Highest permission first; bots last.
        membersList.sort((a, b) => {
          if (a.isBot !== b.isBot) return a.isBot ? 1 : -1;
          return b.permissionLevel - a.permissionLevel;
        });

        const registeredPlayers = Array.from(registeredMap.entries()).map(([userId, reg]) => ({
          userId,
          tag: reg.tag,
          playerName: reg.playerName || null,
          registeredAt: reg.registeredAt,
        }));

        res.status(200).json({
          success: true,
          serverState: services.currentState,
          minecraft: {
            online: livePing?.players.online ?? 0,
            max: livePing?.players.max ?? 0,
            list: livePing?.players.list ?? [],
          },
          registeredPlayers,
          guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            memberCount: guild.memberCount,
            channelsCount: guild.channels.cache.size,
            rolesCount: guild.roles.cache.size,
          },
          members: membersList,
        });
      } catch (err) {
        fail(res, '/members', err);
      }
    })();
  });

  // ─── GET /api/access-control (Public Matrix + Admin Snowflake IDs) ───────────
  router.get('/access-control', (req: Request, res: Response) => {
    try {
      const token = extractToken(req);
      const isAdmin = verifyAdminToken(token);

      const commandList = Array.from(commands.entries())
        .map(([name, cmd]) => ({
          name: `/${name}`,
          requiredPermission: cmd.requiredPermission,
          requiredPermissionName: permissionLevelName(cmd.requiredPermission),
        }))
        .sort((a, b) => b.requiredPermission - a.requiredPermission);

      res.status(200).json({
        success: true,
        isAdmin,
        tiers: [
          {
            level: PermissionLevel.OWNER,
            name: 'Owner',
            description: 'Full access to all commands, features, and controls, including /restart, with no restrictions.',
            userIds: isAdmin ? config.permissions.ownerUserIds : [],
            roleIds: isAdmin ? (config.permissions.ownerRoleIds ?? []) : [],
          },
          {
            level: PermissionLevel.ADMIN,
            name: 'Admin',
            description: 'All Trusted permissions + /force-refresh, panel sync, and Web Admin management.',
            userIds: isAdmin ? config.permissions.adminUserIds : [],
            roleIds: isAdmin ? config.permissions.adminRoleIds : [],
          },
          {
            level: PermissionLevel.TRUSTED,
            name: 'Trusted',
            description: 'All + Minecraft_Role permissions + /stop, dashboard Start & Stop buttons, and Stop Confirmation button.',
            userIds: isAdmin ? config.permissions.trustedUserIds : [],
            roleIds: isAdmin ? config.permissions.trustedRoleIds : [],
          },
          {
            level: PermissionLevel.MINECRAFT,
            name: 'Minecraft_Role',
            description: 'All Everyone permissions + /start.',
            userIds: [],
            roleIds: isAdmin ? config.permissions.minecraftRoleIds : [],
          },
          {
            level: PermissionLevel.EVERYONE,
            name: 'Everyone',
            description: 'Public commands: /status, /info, /players, /ping, /help, /register, /privacy, /terms, and dashboard Refresh button.',
            userIds: [],
            roleIds: ['@everyone'],
          },
        ],
        commands: commandList,
      });
    } catch (err) {
      fail(res, '/access-control', err);
    }
  });

  // ─── GET /api/logs (Admin Protected) ────────────────────────────────────────
  router.get('/logs', requireAdminToken, (req: Request, res: Response) => {
    try {
      const requested = Number(req.query['limit']);
      const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 100, 10), 250);
      res.status(200).json({ success: true, logs: getRecentLogs(limit) });
    } catch (err) {
      fail(res, '/logs', err);
    }
  });

  // ─── POST /api/action/start (Admin Protected + Rate Limited) ────────────────
  router.post('/action/start', requireAdminToken, serverActionRateLimiter, (_req: Request, res: Response) => {
    void (async (): Promise<void> => {
      const state = services.currentState;
      if (
        state === ServerState.ONLINE ||
        state === ServerState.STARTING ||
        state === ServerState.QUEUEING
      ) {
        res.status(409).json({ success: false, error: `The server is already ${state}.` });
        return;
      }

      try {
        logger.info('Web Admin: start requested.');
        await services.aternos.startServer();
        services.currentState = ServerState.STARTING;
        services.beginLaunchWatch?.();
        res.status(202).json({
          success: true,
          message: 'Server start sequence initiated.',
          state: services.currentState,
        });
      } catch (err) {
        fail(res, '/action/start', err);
      }
    })();
  });

  // ─── POST /api/action/stop (Admin Protected + Rate Limited) ─────────────────
  router.post('/action/stop', requireAdminToken, serverActionRateLimiter, (_req: Request, res: Response) => {
    void (async (): Promise<void> => {
      if (services.currentState !== ServerState.ONLINE) {
        res.status(409).json({
          success: false,
          error: `The server is not online (state: ${services.currentState}).`,
        });
        return;
      }

      try {
        logger.info('Web Admin: stop requested.');
        await services.aternos.stopServer();
        services.currentState = ServerState.STOPPING;
        services.forcePoll?.();
        res.status(202).json({
          success: true,
          message: 'Server stop sequence initiated.',
          state: services.currentState,
        });
      } catch (err) {
        fail(res, '/action/stop', err);
      }
    })();
  });

  // ─── POST /api/action/restart (Admin Protected + Rate Limited) ──────────────
  router.post('/action/restart', requireAdminToken, serverActionRateLimiter, (_req: Request, res: Response) => {
    void (async (): Promise<void> => {
      try {
        logger.info('Web Admin: restart requested.');

        if (services.aternos.restartServer) {
          await services.aternos.restartServer();
        } else {
          if (services.currentState === ServerState.ONLINE || services.currentState === ServerState.STARTING) {
            await services.aternos.stopServer();
            services.currentState = ServerState.STOPPING;
            await sleep(5_000);
          }

          await services.aternos.startServer();
        }

        services.currentState = ServerState.STARTING;
        services.serverOnlineAt = null;
        services.beginLaunchWatch?.();

        res.status(202).json({
          success: true,
          message: 'Server restart sequence initiated.',
          state: services.currentState,
        });
      } catch (err) {
        fail(res, '/action/restart', err);
      }
    })();
  });

  // ─── POST /api/action/poll (Admin Protected + Rate Limited) ─────────────────
  router.post('/action/poll', requireAdminToken, serverActionRateLimiter, (_req: Request, res: Response) => {
    services.forcePoll?.();
    res.status(202).json({ success: true, message: 'Server refresh poll triggered.' });
  });

  // ─── POST /api/action/force-refresh (Admin Protected + Rate Limited) ─────────
  router.post('/action/force-refresh', requireAdminToken, serverActionRateLimiter, (_req: Request, res: Response) => {
    void (async (): Promise<void> => {
      try {
        logger.info('Web Admin: force-refresh requested.');
        let freshState = services.currentState;
        let freshMcStatus = services.lastMinecraftStatus;

        if (services.forceRefresh) {
          const result = await services.forceRefresh();
          freshState = result.state;
          freshMcStatus = result.mcStatus;
        } else if (services.forcePoll) {
          services.forcePoll();
        }

        res.status(200).json({
          success: true,
          message: 'Force refresh completed and caches flushed.',
          state: freshState,
          minecraft: freshMcStatus,
        });
      } catch (err) {
        fail(res, '/action/force-refresh', err);
      }
    })();
  });

  return router;
}

function round1(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

/** Logs the detail, returns a generic message — internals stay server-side. */
function fail(res: Response, route: string, err: unknown): void {
  logger.error(`Web API ${route} failed: ${String(err)}`);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
