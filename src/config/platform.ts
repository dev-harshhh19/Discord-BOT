import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Runtime environment detection and Chromium launch profiles.
 *
 * The bot is expected to run unchanged on a desktop, a cloud VPS (x64 or arm64),
 * inside Docker, and on Android via Termux. Those targets need genuinely
 * different Chromium flags — notably `--single-process`, which is required on
 * Termux (Android's zygote is unavailable) but is a known source of renderer
 * crashes on ordinary Linux. Rather than hardcoding one target's flags for
 * everyone, the correct profile is selected here at startup.
 */

export type PlatformKind = 'termux' | 'docker' | 'wsl' | 'linux' | 'macos' | 'windows';

export interface PlatformInfo {
  kind: PlatformKind;
  isTermux: boolean;
  isDocker: boolean;
  isWsl: boolean;
  isRoot: boolean;
  arch: string;
  /** Total system memory in MiB. */
  totalMemoryMb: number;
  /** True when the host has little RAM and Chromium should be trimmed down. */
  isLowMemory: boolean;
  /** True when no X11/Wayland display is reachable (affects headful mode). */
  hasDisplay: boolean;
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function detectTermux(): boolean {
  if (process.env['TERMUX_VERSION']) return true;
  const prefix = process.env['PREFIX'] ?? '';
  if (prefix.includes('com.termux')) return true;
  return fileExists('/data/data/com.termux/files/usr');
}

function detectDocker(): boolean {
  if (process.env['KUBERNETES_SERVICE_HOST']) return true;
  if (fileExists('/.dockerenv')) return true;
  try {
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
    return /docker|containerd|kubepods|podman/.test(cgroup);
  } catch {
    return false;
  }
}

function detectWsl(): boolean {
  if (process.platform !== 'linux') return false;
  try {
    return /microsoft/i.test(os.release());
  } catch {
    return false;
  }
}

function detectPlatform(): PlatformInfo {
  const isTermux = detectTermux();
  const isDocker = !isTermux && detectDocker();
  const isWsl = detectWsl();

  let kind: PlatformKind;
  if (isTermux) kind = 'termux';
  else if (isDocker) kind = 'docker';
  else if (isWsl) kind = 'wsl';
  else if (process.platform === 'win32') kind = 'windows';
  else if (process.platform === 'darwin') kind = 'macos';
  else kind = 'linux';

  const totalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));

  return {
    kind,
    isTermux,
    isDocker,
    isWsl,
    // process.getuid is undefined on Windows.
    isRoot: typeof process.getuid === 'function' && process.getuid() === 0,
    arch: process.arch,
    totalMemoryMb,
    isLowMemory: isDocker || (totalMemoryMb > 0 && totalMemoryMb < 2048),
    hasDisplay:
      process.platform === 'win32' ||
      process.platform === 'darwin' ||
      Boolean(process.env['DISPLAY'] ?? process.env['WAYLAND_DISPLAY']),
  };
}

export const platform: PlatformInfo = detectPlatform();

// ─── Chromium discovery ───────────────────────────────────────────────────────

const TERMUX_PREFIX = process.env['PREFIX'] ?? '/data/data/com.termux/files/usr';

/** Candidate Chromium/Chrome binaries, most specific first, per platform. */
function chromiumCandidates(): string[] {
  if (platform.isTermux) {
    return [
      path.join(TERMUX_PREFIX, 'bin', 'chromium'),
      path.join(TERMUX_PREFIX, 'bin', 'chromium-browser'),
      '/data/data/com.termux/files/usr/bin/chromium',
      '/data/data/com.termux/files/usr/bin/chromium-browser',
    ];
  }

  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] ?? '';
    return [
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      localAppData ? path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe') : '',
      path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    ].filter(Boolean);
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }

  // Linux (bare metal, VPS, Docker, WSL)
  return [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
    '/usr/lib/chromium/chromium',
    '/usr/lib/chromium-browser/chromium-browser',
  ];
}

/**
 * Resolves the Chromium executable to launch.
 *
 * Returns `undefined` to let Puppeteer fall back to its own bundled download,
 * which is the right answer on x64 desktops but never works on Termux/arm.
 */
export function resolveChromiumPath(): string | undefined {
  const explicit = process.env['PUPPETEER_EXECUTABLE_PATH']?.trim();
  if (explicit) {
    if (!fileExists(explicit)) {
      // Surfaced as a warning by the caller rather than thrown: a wrong path in
      // .env should not be fatal if a system Chromium is available.
      return explicit;
    }
    return explicit;
  }

  for (const candidate of chromiumCandidates()) {
    if (fileExists(candidate)) return candidate;
  }

  return undefined;
}

/** True when the configured executable path points at something that exists. */
export function chromiumPathIsValid(execPath: string | undefined): boolean {
  return execPath === undefined || fileExists(execPath);
}

// ─── Launch arguments ─────────────────────────────────────────────────────────

export interface LaunchArgsOptions {
  /** Bind a CDP debugging port on loopback. Off unless explicitly requested. */
  remoteDebuggingPort?: number | null;
  /** Extra flags supplied through `PUPPETEER_EXTRA_ARGS`. */
  extraArgs?: string[];
}

/**
 * Builds the Chromium argument list appropriate for the detected platform.
 *
 * Deliberately excluded from the defaults:
 *   - `--remote-debugging-address=0.0.0.0`: exposes full browser control
 *     (including the authenticated Aternos session) to the network. Opt-in only,
 *     and loopback-bound even then.
 *   - `--single-process` / `--no-zygote` outside Termux: destabilises modern
 *     Chromium on regular Linux hosts.
 */
export function buildChromiumArgs(options: LaunchArgsOptions = {}): string[] {
  const args = [
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-breakpad',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--password-store=basic',
    '--use-mock-keychain',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
  ];

  // Sandboxing requires user namespaces, which are unavailable to root-in-Docker
  // and on Android. Keep the sandbox everywhere it can actually work.
  const needsNoSandbox =
    platform.isTermux ||
    platform.isDocker ||
    platform.isRoot ||
    process.env['PUPPETEER_NO_SANDBOX'] === 'true';
  if (needsNoSandbox) {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  if (platform.isTermux) {
    // Android has no usable zygote and limits the number of child processes
    // (the "phantom process killer"). One process is both required and cheaper.
    args.push('--no-zygote', '--single-process', '--disable-gpu', '--disable-software-rasterizer');
  } else if (platform.kind === 'linux' || platform.isDocker || platform.isWsl) {
    args.push('--disable-gpu');
  }

  if (platform.isLowMemory) {
    args.push('--js-flags=--max-old-space-size=128', '--disable-extensions');
  }

  const port = options.remoteDebuggingPort;
  if (typeof port === 'number' && port > 0) {
    // Loopback only — never 0.0.0.0.
    args.push(`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1');
  }

  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }

  return args;
}

/**
 * A user agent consistent with the host OS.
 *
 * Advertising a Windows UA from an arm64 Linux box is itself a fingerprinting
 * signal, so the platform token is matched to the real machine.
 */
export function defaultUserAgent(chromeMajor = 124): string {
  let osToken: string;
  if (process.platform === 'win32') {
    osToken = 'Windows NT 10.0; Win64; x64';
  } else if (process.platform === 'darwin') {
    osToken = 'Macintosh; Intel Mac OS X 10_15_7';
  } else if (platform.isTermux) {
    osToken = 'Linux; Android 13';
  } else {
    osToken = process.arch === 'arm64' ? 'X11; Linux aarch64' : 'X11; Linux x86_64';
  }

  const mobileSuffix = platform.isTermux ? ' Mobile' : '';
  return (
    `Mozilla/5.0 (${osToken}) AppleWebKit/537.36 (KHTML, like Gecko) ` +
    `Chrome/${chromeMajor}.0.0.0${mobileSuffix} Safari/537.36`
  );
}

/** One-line summary for the startup banner. */
export function describePlatform(): string {
  const bits = [
    `${platform.kind}/${platform.arch}`,
    `node ${process.versions.node}`,
    `${platform.totalMemoryMb}MB RAM`,
  ];
  if (platform.isRoot) bits.push('root');
  if (!platform.hasDisplay && process.platform === 'linux') bits.push('no-display');
  return bits.join(', ');
}
