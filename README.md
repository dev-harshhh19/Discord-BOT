<div align="center">

# TikdiSMP Aternos Manager & Discord Bot

[![GitHub stars](https://img.shields.io/github/stars/dev-harshhh19/Discord-BOT?style=flat-square&color=5865F2)](https://github.com/dev-harshhh19/Discord-BOT/stargazers)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20%20LTS-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.js.org/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-Automated-00D8A2?style=flat-square&logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**A production-ready, resilient TypeScript automation engine and Discord bot designed to monitor, start, stop, and manage Aternos Minecraft servers 24/7.**  
Crafted with high-performance telemetry, direct Minecraft protocol pinging, multi-tiered RBAC, and an integrated real-time Web Dashboard.

[Explore Setup Guide (SETUP.md)](./SETUP.md) • [Termux Android Guide (TERMUX_GUIDE.md)](./TERMUX_GUIDE.md) • [Developer Portfolio](https://harshadnikam.me)

</div>

---

## Highlights & Features

- **Automated Aternos Control:** Autonomous headless Puppeteer service that handles authentication, navigates Cloudflare turnstiles, clicks the Aternos Start/Stop controls, confirms queue prompts, and manages server lifecycle.
- **Direct Minecraft Protocol Telemetry:** Real-time server pinging (`craftping`) directly over TCP/UDP to obtain exact latency, online player rosters, version info, and server MOTD without Aternos web latency.
- **Role-Based Access Control (RBAC):** Multi-tier authorization hierarchy (`Owner`, `Admin`, `Minecraft Role`, `Trusted`, `Public`) with granular permissions across slash commands and web endpoints.
- **Component-Driven Web Dashboard:** Zero-dependency, modern vanilla ES-module dashboard with real-time SSE updates, DDoS/IP rate-limiting, and constant-time password authentication.
- **Hardware-Aware & Low-RAM Optimizations:** Auto-tuning Chromium flags with specialized profiles for Linux VPS, Android (Termux ARM64), Raspberry Pi / Local Home Cloud, and Docker containers.
- **Self-Healing Watchdogs:** Automated queue detection, launch progress state machine, stuck-queue restart cycle, and browser health monitoring with exponential backoff recovery.

---

## System Architecture

```
                    ┌─────────────────────────┐
                    │    Discord Gateway      │
                    │   (Slash Commands &     │
                    │    Interactive UI)      │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────┐
│                      TikdiSMP Bot                         │
│                                                           │
│  ┌──────────────────────┐       ┌──────────────────────┐  │
│  │   Discord Client     │       │   Web Dashboard &    │  │
│  │   (Interaction &     │       │   Telemetry API      │  │
│  │    Event Handlers)   │       │   (Express + SSE)    │  │
│  └──────────┬───────────┘       └──────────┬───────────┘  │
│             │                              │              │
│             ▼                              ▼              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │               Application Coordinator               │  │
│  │   - StatusMonitor Engine    - LaunchProgress State  │  │
│  │   - Role-Based Permissions  - Auto-Heal Watchdog    │  │
│  └──────────┬──────────────────────────────┬───────────┘  │
│             │                              │              │
│             ▼                              ▼              │
│  ┌──────────────────────┐       ┌──────────────────────┐  │
│  │  Puppeteer Aternos   │       │   Craftping Engine   │  │
│  │  Automation Service  │       │   (Direct Protocol   │  │
│  │  (Headless Chrome)   │       │    TCP/UDP Ping)     │  │
│  └──────────┬───────────┘       └──────────┬───────────┘  │
└─────────────┼──────────────────────────────┼──────────────┘
              │                              │
              ▼                              ▼
      ┌───────────────┐              ┌───────────────┐
      │  Aternos Web  │              │  Minecraft    │
      │  Control Node │              │  Game Server  │
      └───────────────┘              └───────────────┘
```

---

## Discord Commands & Permissions

| Command | Description | Minimum Role Required |
|---|---|---|
| `/start` | Initiates the Aternos boot sequence & tracks queue status | `Trusted` / `Minecraft Role` / `Admin` / `Owner` |
| `/stop` | Gracefully shuts down the running server | `Admin` / `Owner` |
| `/restart` | Restarts the server via native Aternos AJAX endpoints or safe sequence | `Owner Only` |
| `/force-refresh` | Clears all memory caches, reloads Aternos panel & syncs live status | `Owner Only` |
| `/status` | Displays live server state, memory, and queue telemetry | Everyone (`Public`) |
| `/players` | Lists currently connected players with online head avatars | Everyone (`Public`) |
| `/ping` | Displays bot gateway latency, API latency, and uptime | Everyone (`Public`) |
| `/info` | Displays server connection parameters, version, and hardware | Everyone (`Public`) |
| `/register` | Optional self-service whitelist registration | Configurable |
| `/help` | Comprehensive interactive command directory | Everyone (`Public`) |

> **Role Hierarchy Note:** Members with a configured `MINECRAFT_ROLE_IDS` role can execute `/start`, `/stop`, `/status`, `/players`, `/ping`, and `/info` (everything except `/restart` and `/force-refresh`, which are strictly restricted to `OWNER_USER_IDS`).

---

## Deployment Options

### 1. Local / PC Deployment (Windows, macOS, Linux)
```bash
# Clone repository
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Run in development mode
npm run dev

# Or build and run production bundle
npm run build
npm start
```

### 2. Linux Cloud VPS (Ubuntu / Debian / AlmaLinux)
```bash
# Install Node.js 20 & Chromium
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs chromium-browser git

# Clone and install
git clone https://github.com/dev-harshhh19/Discord-BOT.git /opt/aternos-bot
cd /opt/aternos-bot
npm install
npm run build

# Manage with PM2
npm install -g pm2
pm2 start dist/index.js --name aternos-bot
pm2 save && pm2 startup
```

### 3. Android Mobile via Termux (Zero-Cost 24/7 Hosting)
Run the bot directly on an old Android phone or tablet without any VPS fees.  
Complete step-by-step guide available in [TERMUX_GUIDE.md](./TERMUX_GUIDE.md).

```bash
# In Termux:
pkg update && pkg install -y nodejs git chromium x11-repo xvfb
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install
cp .env.example .env
# Set PUPPETEER_EXECUTABLE_PATH=/data/data/com.termux/files/usr/bin/chromium-browser
xvfb-run -a npm run dev
```

### 4. Docker & Docker Compose (VPS / Home Cloud / x86 & ARM64)
```bash
# 1. Configure your environment variables
cp .env.example .env
# Edit .env with your Discord Token and Aternos credentials

# 2. Run with Docker Compose (recommended)
docker compose up -d

# 3. View live logs
docker compose logs -f

# 4. Stop when needed
docker compose down
```

Or build manually with standard Docker:
```bash
docker build -t aternos-discord-bot .
docker run -d --name aternos-bot \
  --env-file .env \
  -p 51765176 \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  --shm-size="1gb" \
  aternos-discord-bot
```

---

## Web Dashboard & Telemetry

When `WEB_ENABLED=true` is set, the bot exposes a lightweight, modern web interface (default: `http://localhost5176`):

- **Real-Time Telemetry:** Live ping latency, player counts, CPU/RAM usage, and queue progress.
- **Server Controls:** Trigger start, stop, and restart directly from the web browser.
- **Role-Based Admin Access:** Secure login authenticated against `DASHBOARD_ADMIN_PASSWORD` using constant-time comparison and brute-force protection.
- **Active Players Roster:** Visual player roster with dynamically rendered Minecraft skins.
- **Developer Hub:** Integrated developer profile and project telemetry.

---

## Directory Structure

```
.
├── src/
│   ├── application/        # State management, StatusMonitor & LaunchProgress
│   ├── config/             # Environment validation, platform detection, & paths
│   ├── infrastructure/     # Puppeteer browser service, craftping & logging
│   ├── presentation/       # Discord slash commands, embeds & web routes
│   ├── types/              # TypeScript interface & type definitions
│   ├── utils/              # Permissions, rate limiters, mutex locks & errors
│   └── index.ts            # Main application bootstrap
├── public/                 # Modular Web Dashboard (ES Modules & Static CSS)
│   ├── css/                # Modern design system & component styles
│   ├── js/                 # Modular SPA components & reactive store
│   └── index.html          # Dashboard entry point
├── Dockerfile              # Production container build
├── SETUP.md                # Comprehensive step-by-step installation guide
├── TERMUX_GUIDE.md         # Dedicated Android/Termux setup guide
└── package.json            # Node.js dependencies & scripts
```

---

## Security & Reliability

- **Constant-Time Verification:** Auth tokens and admin passwords are evaluated with `crypto.timingSafeEqual` to eliminate timing attacks.
- **Sliding-Window Rate Limiting:** Web endpoints are protected with configurable in-memory IP rate limiters.
- **Instance Mutual Exclusion:** Stateful filesystem locks prevent concurrent instances from corrupting the Puppeteer browser profile.
- **Clean Process Termination:** Graceful teardown listeners ensure browser processes and Discord gateway connections are cleanly closed upon `SIGINT`/`SIGTERM`.

---

## Developer & Attribution

Developed and maintained by **Harshad Nikam**.

- **Portfolio & Website:** [https://harshadnikam.me](https://harshadnikam.me)
- **GitHub:** [@dev-harshhh19](https://github.com/dev-harshhh19)
- **Avatar:** [Profile CDN](https://cdn.harshadnikam.me/Profile.png)

---

## Disclaimer

**Disclaimer:** This project is in no way affiliated with, authorized, maintained, sponsored, or endorsed by Aternos GmbH or any of its affiliates or subsidiaries. This is an independent, open-source automation utility created for educational and community server administration purposes. Use responsibly in accordance with platform terms of service.
