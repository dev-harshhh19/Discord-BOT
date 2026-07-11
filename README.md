# TikdiSMP Discord Manager Bot

A production-grade TypeScript Discord bot that controls a TikdiSMP Aternos-hosted Minecraft server from within Discord. Built with Clean Architecture, stealth browser automation, and real-time Minecraft protocol queries.

## Features

- **Slash Commands**: `/start`, `/stop`, `/restart`, `/status`, `/players`, `/info`, `/ping`, `/help`
- **Live Dashboard**: Auto-updating pinned embed with interactive Start/Stop/Refresh buttons
- **4-tier RBAC**: Owner > Admin > Trusted > Everyone permission system
- **Minecraft Protocol Queries**: Direct `craftping` server queries (bypasses Aternos)
- **Stealth Automation**: Puppeteer + stealth plugin to control Aternos panel
- **Queue Management**: Auto-detects and confirms Aternos queue position
- **Notifications**: Automatic alerts for server online/offline/crashed/queue events
- **IST Timestamps**: All logs and embeds use Indian Standard Time (UTC+5:30)

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript (strict mode)
- **Discord**: discord.js v14
- **Browser Automation**: Puppeteer + puppeteer-extra-plugin-stealth
- **MC Protocol**: craftping
- **Logging**: Winston
- **Health Server**: Express
- **Build**: tsup
- **CI/CD**: GitHub Actions + Docker

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd server-manager
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `DISCORD_BOT_TOKEN` | From [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_ID` | Your bot's Application ID |
| `DISCORD_GUILD_ID` | Your Discord server ID |
| `CONTROL_CHANNEL_ID` | Channel where the dashboard will be pinned |
| `ATERNOS_USERNAME` | Your Aternos login username |
| `ATERNOS_PASSWORD` | Your Aternos login password |
| `ATERNOS_SERVER_URL` | Full URL to your Aternos server panel |
| `MC_SERVER_ADDRESS` | `TikdiSMP.aternos.me` |
| `MC_SERVER_PORT` | `58844` |
| `OWNER_USER_IDS` | Your Discord user ID (comma-separated for multiple) |
| `ADMIN_USER_IDS` | Admin user IDs (optional) |
| `ADMIN_ROLE_IDS` | Admin role IDs (optional) |
| `TRUSTED_USER_IDS` | Trusted member user IDs (optional) |
| `TRUSTED_ROLE_IDS` | Trusted member role IDs (optional) |

### 3. Run in Development

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

## Permission System

| Level | Who | Commands |
|---|---|---|
| **Owner** | Primary admin (by User ID) | All commands including `/restart` |
| **Admin** | Secondary admins (by User/Role ID) | `/start`, `/stop`, `/status`, `/players`, `/info`, `/ping`, `/help` |
| **Trusted** | Your 4 friends group (by User/Role ID) | `/start`, `/status`, `/players`, `/info`, `/ping`, `/help` |
| **Everyone** | Anyone in the server | `/status`, `/info`, `/help` |

## Deployment

### VPS / Oracle Cloud Free Tier (PM2)

```bash
# Install Node.js 20 LTS and PM2
npm install -g pm2

# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name "tikdismp-bot"
pm2 save
pm2 startup
```

### Docker / Railway / Render

```bash
# Build image
docker build -t tikdismp-bot .

# Run with env file
docker run --env-file .env -p 3000:3000 tikdismp-bot
```

The `/health` endpoint at `http://host:3000/health` is required by PaaS providers.

## Architecture

```
src/
  config/          # Env validation, Aternos selectors, timing constants
  types/           # Global TypeScript interfaces and enums
  infrastructure/  # Puppeteer automation, craftping service, Winston logger
  application/     # StatusMonitor polling engine
  presentation/    # Discord slash commands, events, embed/button components
  utils/           # Permission checks, time formatting, custom errors
  index.ts         # Entry point
```

## Dashboard Embed Colors

| Color | State |
|---|---|
| Green | Online |
| Red | Offline / Stopping / Crashed |
| Yellow | Starting / Queueing |
| Blue | Info / Help |

## Notes on Aternos Automation

Aternos's Terms of Service prohibit automated access. The stealth plugin minimizes detection risk. If the Aternos UI updates and selectors break, edit `src/config/selectors.ts` and redeploy — no other code changes needed.
