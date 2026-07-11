declare module 'craftping' {
  export class SamplePlayer {
    getName(): string;
    getId(): string;
  }

  export class Version {
    getName(): string;
    getProtocol(): number;
  }

  export class Players {
    getOnline(): number;
    getMax(): number;
    getSample(): SamplePlayer[];
  }

  export class JsonStatus {
    getVersion(): Version;
    getPlayers(): Players;
    getDescription(): object;
    getFavicon(): string | null;
  }

  export interface PingOptions {
    hostname?: string;
    port?: number;
    protocolVersion?: number;
    signal?: AbortSignal;
    resolveSrvRecords?: boolean;
  }

  export class JavaPingClient {
    ping(address: string, port: number, options?: PingOptions): Promise<JsonStatus>;
    pingLegacyPost14(address: string, port: number, options?: PingOptions): Promise<object>;
    pingLegacyPre14(address: string, port: number, options?: PingOptions): Promise<object>;
    pingLegacyUniversal(address: string, port: number, options?: PingOptions): Promise<object>;
  }
}
