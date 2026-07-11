import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  Client,
} from 'discord.js';

// ─── Server State ─────────────────────────────────────────────────────────────

export enum ServerState {
  OFFLINE = 'OFFLINE',
  STARTING = 'STARTING',
  QUEUEING = 'QUEUEING',
  ONLINE = 'ONLINE',
  STOPPING = 'STOPPING',
  CRASHED = 'CRASHED',
  UNKNOWN = 'UNKNOWN',
}

// ─── Permission Levels ────────────────────────────────────────────────────────

export enum PermissionLevel {
  EVERYONE = 0,
  TRUSTED = 1,
  ADMIN = 2,
  OWNER = 3,
}

// ─── Minecraft Protocol Types ─────────────────────────────────────────────────

export interface PlayerData {
  name: string;
  id: string;
}

export interface MinecraftStatus {
  online: boolean;
  ip: string;
  port: number;
  version: string;
  latency: number;
  players: {
    online: number;
    max: number;
    list: PlayerData[];
  };
  software: string;
}

// ─── Service Interfaces (Domain Contracts) ────────────────────────────────────

export interface IAternosService {
  init?(): Promise<void>;
  authenticate(): Promise<void>;
  getPanelStatus(): Promise<ServerState>;
  getQueueInfo(): Promise<QueueInfo | null>;
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
  confirmQueue(): Promise<boolean>;
}

export interface IMinecraftService {
  pingServer(): Promise<MinecraftStatus>;
}

// ─── Discord Command Interface ────────────────────────────────────────────────

export interface BotCommand {
  /** The slash command builder definition */
  data: {
    name: string;
    toJSON(): unknown;
  };
  /** The required permission level to execute this command */
  requiredPermission: PermissionLevel;
  /** Execute the slash command */
  execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void>;
}

// ─── Service Container (Dependency Injection) ─────────────────────────────────

export interface ServiceContainer {
  aternos: IAternosService;
  minecraft: IMinecraftService;
  client: Client;
  /** Current server state tracked by the StatusMonitor */
  currentState: ServerState;
  /** Last successful Minecraft status */
  lastMinecraftStatus: MinecraftStatus | null;
  /** Timestamp when server came online (for uptime calculation) */
  serverOnlineAt: Date | null;
  /** ID of the pinned dashboard message */
  dashboardMessageId: string | null;
  /** Force the StatusMonitor to poll immediately */
  forcePoll?: () => void;
}

// ─── Queue Info ───────────────────────────────────────────────────────────────

export interface QueueInfo {
  position: string;
  estimatedTime: string;
}

// ─── Embed Color Palette (strict per PRD) ────────────────────────────────────

export const EMBED_COLORS = {
  ONLINE: 0x57f287,    // Green
  OFFLINE: 0xed4245,   // Red
  STARTING: 0xfee75c,  // Yellow
  QUEUEING: 0xfee75c,  // Yellow
  INFO: 0x5865f2,      // Blue (Discord Blurple)
  WARNING: 0xffa500,   // Orange
  ERROR: 0xed4245,     // Red
} as const;

// ─── Button Custom IDs ────────────────────────────────────────────────────────

export const BUTTON_IDS = {
  DASHBOARD_START: 'dashboard_start',
  DASHBOARD_STOP: 'dashboard_stop',
  DASHBOARD_REFRESH: 'dashboard_refresh',
  STOP_CONFIRM: 'stop_confirm',
  STOP_CANCEL: 'stop_cancel',
} as const;

// ─── Button Interaction Handler ───────────────────────────────────────────────

export interface ButtonHandler {
  customId: string;
  requiredPermission: PermissionLevel;
  execute(interaction: ButtonInteraction, services: ServiceContainer): Promise<void>;
}
