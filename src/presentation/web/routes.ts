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
            name: 'Owner / Super Admin',
            description: 'Exclusive authorization for /restart and critical host control.',
            userIds: isAdmin ? config.permissions.ownerUserIds : [],
            roleIds: [],
          },
          {
            level: PermissionLevel.ADMIN,
            name: 'Admin / Minecraft Role',
            description: 'Can run all commands (/stop, /start, /players, /ping, etc.) except /restart.',
            userIds: isAdmin ? config.permissions.adminUserIds : [],
            roleIds: isAdmin
              ? [
                ...config.permissions.adminRoleIds,
                ...config.permissions.minecraftRoleIds.map((id) => `${id} [Minecraft Role]`),
              ]
              : [],
          },
          {
            level: PermissionLevel.TRUSTED,
            name: 'Trusted Member',
            description: 'Can start the server and query detailed player stats.',
            userIds: isAdmin ? config.permissions.trustedUserIds : [],
            roleIds: isAdmin ? config.permissions.trustedRoleIds : [],
          },
          {
            level: PermissionLevel.EVERYONE,
            name: 'Everyone',
            description: 'Public commands: /status, /info, /help, /register.',
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
