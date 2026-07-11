import { JavaPingClient } from 'craftping';
import { IMinecraftService, MinecraftStatus, PlayerData } from '../../types';
import { config } from '../../config/env';
import { logger } from '../logger/WinstonLogger';
import { MinecraftQueryError } from '../../utils/errors';

/** Timeout for Minecraft ping — calibrated for India→Europe latency (140-200ms + buffer) */
const PING_TIMEOUT_MS = 8_000;

export class CraftpingService implements IMinecraftService {
  private readonly address: string;
  private readonly port: number;
  private readonly client: JavaPingClient;

  /** Consecutive failure counter for debouncing ONLINE→OFFLINE transitions */
  private consecutiveFailures = 0;
  /** Required consecutive failures before confirming offline state */
  private readonly failureThreshold = 2;

  constructor() {
    this.address = config.MC_SERVER_ADDRESS;
    this.port = config.MC_SERVER_PORT;
    this.client = new JavaPingClient();
  }

  async pingServer(): Promise<MinecraftStatus> {
    const startTime = Date.now();

    try {
      const timeoutSignal = AbortSignal.timeout(PING_TIMEOUT_MS);

      // JavaPingClient.ping() handles SRV resolution internally via resolveSrv()
      const status = await this.client.ping(this.address, this.port, {
        resolveSrvRecords: true,
        signal: timeoutSignal,
      });

      const latency = Date.now() - startTime;

      // Reset failure counter on success
      this.consecutiveFailures = 0;

      const description = status.getDescription();
      const descriptionText = typeof description === 'string' 
        ? description 
        : JSON.stringify(description);

      // Aternos proxies respond to pings even when the server is offline
      if (descriptionText.toLowerCase().includes('server is offline')) {
        throw new MinecraftQueryError('Aternos proxy reported server is offline');
      }

      const players = status.getPlayers();
      const version = status.getVersion();

      const playerList: PlayerData[] = (players.getSample() ?? []).map((p) => ({
        name: p.getName(),
        id: p.getId(),
      }));

      const mcStatus: MinecraftStatus = {
        online: true,
        ip: this.address,
        port: this.port,
        version: version.getName() ?? '1.21.6',
        latency,
        players: {
          online: players.getOnline(),
          max: players.getMax(),
          list: playerList,
        },
        software: this.extractSoftware(version.getName() ?? ''),
      };

      logger.debug(
        `MC ping OK: ${mcStatus.players.online}/${mcStatus.players.max} players, ${latency}ms`,
      );

      return mcStatus;
    } catch (err) {
      this.consecutiveFailures++;
      logger.warn(
        `MC ping failed (attempt ${this.consecutiveFailures}/${this.failureThreshold}): ${String(err)}`,
      );

      if (this.consecutiveFailures < this.failureThreshold) {
        throw new MinecraftQueryError(
          `Ping failed (${this.consecutiveFailures}/${this.failureThreshold} failures, awaiting threshold)`,
        );
      }

      throw new MinecraftQueryError(`Server unreachable after ${this.failureThreshold} attempts`);
    }
  }

  private extractSoftware(versionName: string): string {
    const v = versionName.toLowerCase();
    if (v.includes('paper')) return 'Paper';
    if (v.includes('spigot')) return 'Spigot';
    if (v.includes('purpur')) return 'Purpur';
    if (v.includes('fabric')) return 'Fabric';
    if (v.includes('forge')) return 'Forge';
    return 'Vanilla';
  }
}
