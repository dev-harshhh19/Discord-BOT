<div align="center">

# TomMC-SMP Bot — Complete Setup & Deployment Guide

**Comprehensive step-by-step documentation for deploying the Aternos Discord Bot across Local Workstations, Cloud VPS (x86 & ARM64), Multi-Platform Docker, Home Servers, and Termux.**

Developed by **[Harshad Nikam](https://harshadnikam.me)** • [@dev-harshhh19](https://github.com/dev-harshhh19)

</div>

---

## Table of Contents

1. [Prerequisites & System Requirements](#1-prerequisites--system-requirements)
2. [Discord Bot Setup & Gateway Configuration](#2-discord-bot-setup--gateway-configuration)
3. [Aternos Server Configuration](#3-aternos-server-configuration)
4. [Environment Configuration (.env)](#4-environment-configuration-env)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Local Machine Deployment](#6-local-machine-deployment)
7. [Cloud VPS Deployment (Ubuntu / Debian / Oracle Cloud)](#7-cloud-vps-deployment-ubuntu--debian--oracle-cloud)
8. [Docker & Docker Compose Deployment (Multi-Arch)](#8-docker--docker-compose-deployment-multi-arch)
9. [Raspberry Pi & Home Cloud Deployment](#9-raspberry-pi--home-cloud-deployment)
10. [Web Dashboard & Security Setup](#10-web-dashboard--security-setup)
11. [Troubleshooting & FAQs](#11-troubleshooting--faqs)

---

## 1. Prerequisites & System Requirements

| Platform | Minimum Specs | Recommended Specs | Software Dependencies |
|---|---|---|---|
| **Local Machine** | 1 Core CPU, 1 GB RAM | 2 Cores, 2 GB RAM | Node.js v20+ LTS, Git, Chrome/Chromium |
| **Cloud VPS (x86_64 / ARM64)** | 1 vCPU, 1 GB RAM | 2 vCPU, 2 GB RAM | Node.js v20, Chromium, PM2, Git |
| **Docker (Any Host)** | 1 Core, 1 GB RAM | 2 Cores, 2 GB RAM | Docker Engine v24+, Docker Compose v2+ |
| **Android / Termux** | ARM64 Android 9+ | 4 GB+ RAM Device | Termux (F-Droid), Node.js, Chromium, Xvfb |

---

## 2. Discord Bot Setup & Gateway Configuration

### Step 2.1 — Create Application on Discord Developer Portal
1. Navigate to the **[Discord Developer Portal](https://discord.com/developers/applications)**.
2. Click **New Application** (top right) and name it (e.g. `TomMC-SMP Manager`).
3. Under the **General Information** tab, copy and save your **Application ID** (`DISCORD_CLIENT_ID`).

### Step 2.2 — Generate Bot Token & Enable Privileged Intents
1. In the left navigation menu, click **Bot**.
2. Click **Reset Token** (authenticate with 2FA if prompted) and copy your token (`DISCORD_BOT_TOKEN`).
3. Scroll down to **Privileged Gateway Intents** and enable:
   -  **Server Members Intent** (Allows fetching member names, avatars, and presence for `/players` and Web Dashboard)
   -  **Message Content Intent** (Allows reading interactive messages)
4. Click **Save Changes**.

### Step 2.3 — Generate Bot Invite URL & Authorize
1. In the left menu, select **OAuth2** → **URL Generator**.
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Embed Links`
   - `Attach Files`
   - `Read Message History`
   - `Manage Messages` (Required to pin and update the live dashboard embed)
   - `Use Slash Commands`
4. Copy the generated authorization link, open it in your browser, select your Discord server, and click **Authorize**.

---

## 3. Aternos Server Configuration

1. Log into your account at **[Aternos](https://aternos.org)**.
2. Click on your Minecraft server to enter its management panel.
3. Copy the full panel URL from your address bar (e.g., `https://aternos.org/server/` or `https://aternos.org/server/YOUR_SERVER_ID`).
4. Note your Aternos **Username** and **Password** (or export your active session cookie for headless bypass).
5. In your Aternos server options, ensure `online-mode` is configured according to your player base (Java/Bedrock/Cracked) and that the server port is noted.

---

## 4. Environment Configuration (.env)

Copy the `.env.example` file to create your active `.env`:

```bash
cp .env.example .env
```

Edit `.env` using your preferred editor:

```env
# ── Discord Configuration ─────────────────────────────────────────────────────
DISCORD_BOT_TOKEN="your_bot_token_here"
DISCORD_CLIENT_ID="your_application_id_here"
# Leave empty for global registration, or supply Guild ID for instant registration
DISCORD_GUILD_ID="your_guild_id_here"
# Channel where live status embeds and logs will be posted & pinned
CONTROL_CHANNEL_ID="your_control_channel_id_here"

# ── Aternos Credentials ───────────────────────────────────────────────────────
ATERNOS_USERNAME="your_aternos_username"
ATERNOS_PASSWORD="your_aternos_password"
ATERNOS_SERVER_URL="https://aternos.org/server/"

# ── Minecraft Protocol Pinging (Direct craftping) ──────────────────────────────
MC_SERVER_ADDRESS="TomMC-SMP.aternos.me"
MC_SERVER_PORT="25565"
MC_PING_TIMEOUT_MS="8000"

# ── Access Control (Snowflake IDs, comma-separated) ───────────────────────────
OWNER_USER_IDS="123456789012345678"
ADMIN_USER_IDS="234567890123456789"
ADMIN_ROLE_IDS="345678901234567890"
# Minecraft Role: Can execute all commands EXCEPT /restart
MINECRAFT_ROLE_IDS="456789012345678901"
TRUSTED_USER_IDS="567890123456789012"
TRUSTED_ROLE_IDS=""

# ── Web Dashboard & Security ──────────────────────────────────────────────────
WEB_ENABLED="true"
WEB_HOST="0.0.0.0"
PORT="5176"
DASHBOARD_ADMIN_PASSWORD="change_this_to_a_secure_admin_password"
WEB_EXPOSE_MEMBERS="true"

# ── Polling & Engine ──────────────────────────────────────────────────────────
POLL_INTERVAL_SECONDS="45"
LAUNCH_POLL_INTERVAL_SECONDS="10"
LAUNCH_WATCH_TIMEOUT_MINUTES="45"
LOG_LEVEL="info"
```

---

## 5. Role-Based Access Control (RBAC)

The bot enforces a multi-tier permission matrix:

| Permission Level | Commands & Features Allowed | Configuration Key |
|---|---|---|
| **Owner** | Full privileges: `/restart`, `/force-refresh`, `/stop`, `/start`, `/status`, `/players`, `/ping`, `/info`, Admin Web Dashboard | `OWNER_USER_IDS` |
| **Admin** | Operations: `/stop`, `/start`, `/status`, `/players`, `/ping`, `/info`, Admin Web Dashboard | `ADMIN_USER_IDS`, `ADMIN_ROLE_IDS` |
| **Minecraft Role** | Full player operations: `/stop`, `/start`, `/status`, `/players`, `/ping`, `/info` *(Restricted from `/restart` & `/force-refresh`)* | `MINECRAFT_ROLE_IDS` |
| **Trusted** | Safe start & telemetry: `/start`, `/status`, `/players`, `/ping`, `/info` | `TRUSTED_USER_IDS`, `TRUSTED_ROLE_IDS` |
| **Public / Everyone** | Read-only telemetry: `/status`, `/players`, `/ping`, `/info`, `/help` | Built-in default |

---

## 6. Local Machine Deployment

### Windows / macOS / Linux

```bash
# 1. Clone repository
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT

# 2. Install dependencies
npm install

# 3. Create and fill .env
cp .env.example .env

# 4. Start in development mode (hot-reloading)
npm run dev

# 5. Or build and run production artifact
npm run build
npm start
```

---

## 7. Cloud VPS Deployment (Ubuntu / Debian / Oracle Cloud)

Deploying on a cloud VPS ensures 24/7 uptime without keeping your personal computer running.

### Step 7.1 — Update Server & Install Node.js 20 LTS
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git chromium-browser dumb-init
```

### Step 7.2 — Install Chrome Dependencies
```bash
sudo apt install -y \
  libnss3 libasound2 libgbm1 libxss1 libxshmfence1 \
  fonts-liberation fonts-freefont-ttf fonts-noto-color-emoji
```

### Step 7.3 — Clone & Build Project
```bash
git clone https://github.com/dev-harshhh19/Discord-BOT.git /opt/aternos-bot
cd /opt/aternos-bot
npm install
npm run build
```

### Step 7.4 — Configure PM2 Process Manager
```bash
sudo npm install -g pm2
cp .env.example .env
nano .env # Paste your credentials

# Launch with PM2
pm2 start dist/index.js --name "aternos-bot"
pm2 save
pm2 startup
```

---

## 8. Docker & Docker Compose Deployment (Multi-Arch)

Our multi-stage Docker build is engineered with native Chromium packages, non-root security, and `dumb-init` process reaping. It natively supports **x86_64 (amd64)** and **ARM64 (aarch64)**.

### Method 1: Using Docker Compose (Recommended)

```bash
# 1. Clone repo
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT

# 2. Setup .env file
cp .env.example .env
nano .env

# 3. Launch container in detached mode
docker compose up -d --build

# 4. View live logs
docker compose logs -f
```

### Method 2: Pure Docker CLI

```bash
# Build the multi-arch image
docker build -t devharsh19/aternos-discord-bot:latest .

# Run container with shared memory and volume mounts
docker run -d \
  --name aternos-bot \
  --restart unless-stopped \
  --shm-size=1g \
  --env-file .env \
  -p 51765176 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  devharsh19/aternos-discord-bot:latest
```

---

## 9. Raspberry Pi & Home Cloud Deployment

Running on a **Raspberry Pi 4 / 5**, **Proxmox VM**, **TrueNAS SCALE**, or **unRAID** Home Server:

1. **Architecture Compatibility:** The Dockerfile and native Node runtime automatically detect ARM64/aarch64 and point Puppeteer to the native system Chromium.
2. **Shared Memory Allocation:** Always include `--shm-size=1g` or `shm_size: '1gb'` in your container configuration to prevent Chromium crashes under low-memory scenarios.
3. **Persistent Volume:** Mount `./data` to preserve your browser login state and avoiding frequent Aternos re-authentication challenges.

---

## 10. Web Dashboard & Security Setup

When `WEB_ENABLED=true`, the built-in HTTP server provides real-time telemetry and control:

- **Dashboard URL:** `http://<your-server-ip>5176/`
- **Telemetry Endpoints:**
  - `GET /health` — Uptime and health check for cloud monitors.
  - `GET /api/status` — Live Minecraft & Aternos telemetry.
  - `GET /api/events` — Server-Sent Events (SSE) stream for instant UI updates.
  - `GET /api/members` — Guild members roster with avatars and online status.
  - `GET /api/dev` — Developer and project metadata.
  - `POST /api/auth/login` — Constant-time admin authentication.
  - `POST /api/server/action` — Trigger `start`, `stop`, or `restart` (Admin token required).

> **Security Note:** Ensure `DASHBOARD_ADMIN_PASSWORD` is set to a long, high-entropy password in `.env`.

---

## 11. Troubleshooting & FAQs

### Q: Puppeteer fails to click the Aternos Start button
**Resolution:** Aternos periodically updates its button classes. The bot includes automatic multi-selector fallback logic. You can also override the selector directly in `.env`:
```env
SELECTOR_START_BUTTON="#start, .btn-start, button.server-action"
```

### Q: Slash commands do not show up in Discord
**Resolution:**
- If `DISCORD_GUILD_ID` is set, commands register instantly to that guild.
- If `DISCORD_GUILD_ID` is blank, commands register globally across all guilds (Discord takes up to 1 hour to propagate global commands).

### Q: Docker container crashes with "Session closed" or "Target crashed"
**Resolution:** Chromium ran out of shared memory. Ensure your Docker run command includes `--shm-size=1g` (or use `docker-compose.yml`).

---

## Developer & Support

Created and maintained by **Harshad Nikam**.

- **Website:** [https://harshadnikam.me](https://harshadnikam.me)
- **GitHub:** [@dev-harshhh19](https://github.com/dev-harshhh19)
- **Issues & Contributions:** [GitHub Issues](https://github.com/dev-harshhh19/Discord-BOT/issues)
