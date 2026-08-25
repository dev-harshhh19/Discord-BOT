import { JavaPingClient } from 'craftping';
import { IMinecraftService, MinecraftStatus, PlayerData } from '../../types';
import { config } from '../../config/env';
import { logger } from '../logger/WinstonLogger';
import { MinecraftQueryError } from '../../utils/errors';

/**
 * Queries the Minecraft server directly over the Server List Ping protocol.
 *
 * This is the authoritative liveness signal: it reflects the actual game
 * server, not the Aternos control panel, and costs a single TCP round trip
 * rather than a browser page load.
 */
export class CraftpingService implements IMinecraftService {
  private readonly client = new JavaPingClient();

  /**
   * Consecutive failures, used to debounce ONLINE → OFFLINE. A single dropped
   * packet on a mobile connection must not flip the dashboard to offline.
   */
  private consecutiveFailures = 0;

  /** Resets consecutive failure counter so next check is fresh */
  reset(): void {
    this.consecutiveFailures = 0;
  }

  async pingServer(): Promise<MinecraftStatus> {
    const address = config.minecraft.address;
    const port = config.minecraft.port;
    const startTime = Date.now();

    try {
      const status = await this.client.ping(address, port, {
        resolveSrvRecords: true,
        signal: AbortSignal.timeout(config.minecraft.pingTimeoutMs),
      });

      const latency = Date.now() - startTime;
      const description = this.describeMotd(status.getDescription());
      const version = status.getVersion();
      const versionName = version.getName() ?? 'Unknown';
      const protocol = version.getProtocol();

      // Aternos keeps a proxy listening on the address even while the server is
      // down or starting; it answers pings with an "offline" MOTD or protocol -1.
      // Treating that as ONLINE would make the bot believe the server is up prematurely.
      if (
        protocol === -1 ||
        /server is offline|server is not running|loading|starting|preparing/i.test(description) ||
        /offline|loading|starting|preparing/i.test(versionName)
      ) {
        throw new MinecraftQueryError('The Aternos proxy reports the server is not ready/offline.');
      }

      this.consecutiveFailures = 0;

      const players = status.getPlayers();

      const playerList: PlayerData[] = (players.getSample() ?? []).map((p) => {
        const rawName = p.getName();
        let nameStr = 'Unknown';
        
        if (typeof rawName === 'string') {
          nameStr = rawName;
        } else if (rawName && typeof rawName === 'object') {
          // Sometimes mods or newer versions send Chat Components in the sample.
          // Try to extract the 'text' property or stringify it.
          const obj = rawName as Record<string, unknown>;
          if (typeof obj.text === 'string') {
             nameStr = obj.text;
             if (Array.isArray(obj.extra)) {
                nameStr += obj.extra
                  .map((e: unknown) => {
                    if (e && typeof e === 'object' && 'text' in e) {
                      return String((e as Record<string, unknown>).text || '');
                    }
                    return '';
                  })
                  .join('');
             }
          } else {
             // Fallback to removing any weird object representation
             nameStr = JSON.stringify(rawName);
          }
        } else {
          nameStr = String(rawName);
        }

        // Clean up any weird artifacts if they still appear
        nameStr = nameStr.replace(/\[object Object\]/g, '').trim();

        return {
          name: nameStr || 'Unknown',
          id: p.getId() || '',
        };
      });

      const mcStatus: MinecraftStatus = {
        online: true,
        ip: address,
        port,
        version: versionName,
        latency,
        players: {
          online: players.getOnline(),
          max: players.getMax(),
          list: playerList,
        },
        software: this.extractSoftware(versionName),
      };

      logger.debug(
        `Ping OK: ${mcStatus.players.online}/${mcStatus.players.max} players, ${latency}ms.`,
      );
      return mcStatus;
    } catch (err) {
      this.consecutiveFailures++;
      const threshold = config.minecraft.failureThreshold;

      logger.debug(
        `Ping failed (${this.consecutiveFailures}/${threshold}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      if (this.consecutiveFailures < threshold) {
        // Signalled via a typed property rather than message text, so callers
        // do not have to string-match to distinguish "not yet sure" from "down".
        throw new MinecraftQueryError(
          `Ping failed (${this.consecutiveFailures}/${threshold}); below the failure threshold.`,
          true,
        );
      }

      throw new MinecraftQueryError(
        `${address}:${port} was unreachable across ${threshold} consecutive attempts.`,
      );
    }
  }

  /** MOTDs arrive as either a plain string or a nested chat-component object. */
  private describeMotd(description: unknown): string {
    if (typeof description === 'string') return description;
    try {
      return JSON.stringify(description);
    } catch {
      return '';
    }
  }

  private extractSoftware(versionName: string): string {
    const v = versionName.toLowerCase();
    if (v.includes('paper')) return 'Paper';
    if (v.includes('purpur')) return 'Purpur';
    if (v.includes('spigot')) return 'Spigot';
    if (v.includes('bukkit')) return 'Bukkit';
    if (v.includes('fabric')) return 'Fabric';
    if (v.includes('forge')) return 'Forge';
    if (v.includes('velocity') || v.includes('bungee')) return 'Proxy';
    return 'Vanilla';
  }
}
