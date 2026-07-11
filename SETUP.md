# TikdiSMP Bot — Complete Setup Guide

This guide walks you through every single step required to get the bot running — from creating your Discord application to starting the bot for the first time. Follow each section in order.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create the Discord Application & Bot](#2-create-the-discord-application--bot)
3. [Invite the Bot to Your Server](#3-invite-the-bot-to-your-server)
4. [Get Your Discord IDs](#4-get-your-discord-ids)
5. [Set Up the Aternos Server URL](#5-set-up-the-aternos-server-url)
6. [Configure the .env File](#6-configure-the-env-file)
7. [Run the Bot](#7-run-the-bot)
8. [First Launch — What to Expect](#8-first-launch--what-to-expect)
9. [Deploying to a VPS (Production)](#9-deploying-to-a-vps-production)
10. [Deploying with Docker](#10-deploying-with-docker)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

Before starting, make sure the following are installed on your machine:

| Software | Minimum Version | Check Command | Download |
|---|---|---|---|
| Node.js | v20 LTS | `node --version` | https://nodejs.org |
| npm | v10+ | `npm --version` | Comes with Node.js |
| Git | Any | `git --version` | https://git-scm.com |

Also make sure you have:
- A **Discord account** with a server you own or admin in.
- An **Aternos account** with the TikdiSMP server already created.

---

## 2. Create the Discord Application & Bot

### Step 2.1 — Open the Developer Portal

Go to: **https://discord.com/developers/applications**

Log in with your Discord account if prompted.

### Step 2.2 — Create a New Application

1. Click the blue **"New Application"** button in the top-right.
2. Give it a name — e.g., `TikdiSMP Manager`.
3. Accept the Terms of Service.
4. Click **"Create"**.

> You are now on your application's **General Information** page.

### Step 2.3 — Copy Your Client ID (Application ID)

On the **General Information** tab:

1. Scroll down to the **"Application ID"** field.
2. Click **"Copy"** next to it.
3. Save it somewhere — this is your `DISCORD_CLIENT_ID`.

It looks like: `1234567890123456789`

### Step 2.4 — Create the Bot User

1. In the left sidebar, click **"Bot"**.
2. Click **"Add Bot"**, then confirm with **"Yes, do it!"**.
3. Your bot is now created.

### Step 2.5 — Copy the Bot Token

> **WARNING: Treat your bot token like a password. Never share it, commit it to Git, or post it anywhere.**

On the **Bot** page:

1. Under the username field, click **"Reset Token"** (you may need to enter your 2FA code).
2. Click **"Copy"** on the token that appears.
3. Save it — this is your `DISCORD_BOT_TOKEN`.

It looks like: `MTIzNDU2Nzg5.GAbCdE.xYz1234...`

> You can only see the token once. If you close the page without copying it, you will need to reset it again.

### Step 2.6 — Enable Required Bot Permissions

Still on the **Bot** page, scroll down to **"Privileged Gateway Intents"**:

- Enable **"Server Members Intent"**
- Enable **"Message Content Intent"**

Click **"Save Changes"**.

---

## 3. Invite the Bot to Your Server

### Step 3.1 — Generate an Invite Link

1. In the left sidebar, click **"OAuth2"** → **"URL Generator"**.
2. Under **"Scopes"**, check:
   - `bot`
   - `applications.commands`
3. Under **"Bot Permissions"**, check:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`
   - `Manage Messages` (needed to pin the dashboard)
   - `Use Slash Commands`
   - `View Channels`

4. Scroll to the bottom — copy the **"Generated URL"**.

### Step 3.2 — Invite the Bot

1. Paste the URL into your browser.
2. Select your Discord server from the dropdown.
3. Click **"Authorize"** and complete the CAPTCHA.

The bot will appear in your server as offline — it goes online when you run it.

---

## 4. Get Your Discord IDs

You need to collect several IDs. First, enable **Developer Mode** in Discord:

### Enable Developer Mode

1. Open Discord → click the gear icon ⚙️ (User Settings) at the bottom-left.
2. Go to **App Settings → Advanced**.
3. Toggle **"Developer Mode"** ON.

Now you can right-click anything to copy its ID.

---

### 4.1 — Get Your Discord Guild ID (Server ID)

This is your Discord server's unique ID.

1. Right-click your **server icon** in the left sidebar.
2. Click **"Copy Server ID"**.
3. Save it — this is your `DISCORD_GUILD_ID`.

It looks like: `987654321098765432`

---

### 4.2 — Get the Control Channel ID

This is the channel where the bot will pin its live dashboard.

> **Tip:** Create a dedicated channel like `#server-control` or `#bot-dashboard` for a clean setup.

1. Right-click the **channel name** in the channel list.
2. Click **"Copy Channel ID"**.
3. Save it — this is your `CONTROL_CHANNEL_ID`.

It looks like: `112233445566778899`

Make sure the bot has permission to **send messages**, **embed links**, and **manage messages** (for pinning) in this channel.

---

### 4.3 — Get Discord User IDs

You need User IDs for the permission system.

#### Your own User ID (Owner)

1. Right-click **your own username** anywhere in the server.
2. Click **"Copy User ID"**.
3. Save it — this goes into `OWNER_USER_IDS`.

#### Your friends' User IDs (Trusted Members)

Repeat the same steps for each of your friends:

1. Right-click their **username**.
2. Click **"Copy User ID"**.
3. Collect all IDs — separate them with commas in `TRUSTED_USER_IDS`.

Example: `111111111111111111,222222222222222222,333333333333333333`

---

### 4.4 — Get Role IDs (Optional)

If you prefer role-based access instead of (or in addition to) user IDs:

1. Go to **Server Settings → Roles**.
2. Right-click the role name.
3. Click **"Copy Role ID"**.

Put Admin role IDs in `ADMIN_ROLE_IDS` and Trusted role IDs in `TRUSTED_ROLE_IDS` (comma-separated).

---

## 5. Set Up the Aternos Server URL

### Step 5.1 — Log In to Aternos

Go to **https://aternos.org** and log in with the account that owns the TikdiSMP server.

### Step 5.2 — Navigate to Your Server Panel

1. Click on your server (TikdiSMP) from the server list.
2. You will be taken to the server control panel.

### Step 5.3 — Copy the Panel URL

Look at your browser's address bar. The URL will look like one of these:

```
https://aternos.org/server/AbCdEfGhIjKl
https://aternos.org/server/#AbCdEfGhIjKl
```

Copy the **entire URL** from your address bar.  
This is your `ATERNOS_SERVER_URL`.

> **Important:** The bot needs to navigate to this exact URL every time it checks or controls the server. Make sure it is the server management page, not the main Aternos homepage.

---

## 6. Configure the .env File

### Step 6.1 — Create the file

In the project folder (`Server-manager/`), copy the example file:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

### Step 6.2 — Open and fill in the values

Open `.env` in any text editor (Notepad, VS Code, etc.).

Here is every variable explained:

```env
# ── Discord ──────────────────────────────────────────────────────────────────

# Your bot token from Discord Developer Portal → Bot → Reset Token
DISCORD_BOT_TOKEN="MTIzNDU2Nzg5.GAbCdE.xYz1234..."

# Your Application ID from Developer Portal → General Information
DISCORD_CLIENT_ID="1234567890123456789"

# Your Discord server ID (right-click server icon → Copy Server ID)
DISCORD_GUILD_ID="987654321098765432"

# The channel where the live dashboard will be pinned
# (right-click channel → Copy Channel ID)
CONTROL_CHANNEL_ID="112233445566778899"


# ── Aternos ───────────────────────────────────────────────────────────────────

# Your Aternos login username (the one you log in with at aternos.org)
ATERNOS_USERNAME="your_aternos_username"

# Your Aternos login password
ATERNOS_PASSWORD="your_aternos_password"

# Full URL to your Aternos server panel page (copy from your browser address bar)
ATERNOS_SERVER_URL="https://aternos.org/server/AbCdEfGhIjKl"


# ── Minecraft Server ──────────────────────────────────────────────────────────

# Already filled in for TikdiSMP — do not change unless your server address changes
MC_SERVER_ADDRESS="TikdiSMP.aternos.me"
MC_SERVER_PORT="58844"


# ── Permissions ───────────────────────────────────────────────────────────────

# Your Discord User ID — gets FULL access (Owner)
# Right-click your own name → Copy User ID
OWNER_USER_IDS="your_user_id_here"

# Other admin user IDs — separate with commas, no spaces (optional)
# ADMIN_USER_IDS="id1,id2"
ADMIN_USER_IDS=""

# Admin role IDs — if you want to use roles instead of user IDs (optional)
# ADMIN_ROLE_IDS="role_id_1,role_id_2"
ADMIN_ROLE_IDS=""

# Your 3 friends' user IDs — they can /start the server and view /players
# Separate with commas: "id1,id2,id3"
TRUSTED_USER_IDS="friend1_id,friend2_id,friend3_id"

# Trusted role IDs — optional role-based access for Trusted tier
TRUSTED_ROLE_IDS=""


# ── Polling ───────────────────────────────────────────────────────────────────

# How often (in seconds) the bot checks the server status — default is 45
POLL_INTERVAL_SECONDS="45"


# ── Logging ───────────────────────────────────────────────────────────────────

# Log verbosity: "error", "warn", "info", or "debug"
# Use "debug" if something is not working and you want detailed logs
LOG_LEVEL="info"
```

### Step 6.3 — Save the file

Make sure the file is saved as `.env` — **not** `.env.txt`.

> **Never commit `.env` to Git.** It is already in `.gitignore`, so this is handled automatically as long as you do not force-add it.

---

## 7. Run the Bot

### Step 7.1 — Install dependencies (first time only)

Open a terminal/PowerShell in the `Server-manager/` folder and run:

```bash
npm install
```

This downloads all required packages (~440 packages, ~300MB including Puppeteer's Chromium).

### Step 7.2 — Start in development mode

```bash
npm run dev
```

This uses `tsx` for hot-reload — the bot restarts automatically when you change a file.

### Step 7.3 — Or build and start in production mode

```bash
npm run build
npm start
```

---

## 8. First Launch — What to Expect

When the bot starts for the first time, watch the console output. You should see:

```
[2026-07-11 17:30:00 IST] [INFO] Health server listening on port 3000
[2026-07-11 17:30:01 IST] [INFO] Logging in to Discord...
[2026-07-11 17:30:02 IST] [INFO] Bot logged in as TikdiSMP Manager#1234
[2026-07-11 17:30:02 IST] [INFO] Registering slash commands...
[2026-07-11 17:30:03 IST] [INFO] Successfully registered 8 slash command(s).
[2026-07-11 17:30:03 IST] [INFO] Dashboard message created and pinned: 1234567890...
[2026-07-11 17:30:03 IST] [INFO] StatusMonitor starting (default interval: 45s)
[2026-07-11 17:30:03 IST] [INFO] Bot is fully operational.
```

**In Discord, you will see:**

1. The bot appears **Online** in your server's member list.
2. In your control channel (`CONTROL_CHANNEL_ID`), a **pinned dashboard embed** appears with the server state (initially Offline/Unknown).
3. Slash commands appear in the `/` menu.

> Slash commands may take up to **1 hour** to appear globally after the first registration. For your specific guild, they should appear within a few seconds.

---

## 9. Deploying to a VPS (Production)

This is the recommended production method for 24/7 uptime. Oracle Cloud Free Tier (2 vCPUs, 1GB RAM) works great.

### Step 9.1 — Connect to your VPS

```bash
ssh your_username@your_vps_ip
```

### Step 9.2 — Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should print v20.x.x
```

### Step 9.3 — Install Chrome dependencies (for Puppeteer)

```bash
sudo apt-get install -y \
  libnss3 libasound2 libgbm1 libxss1 \
  fonts-ipafont-gothic fonts-wqy-zenhei \
  fonts-thai-tlwg fonts-kacst fonts-freefont-ttf
```

### Step 9.4 — Clone and set up the project

```bash
git clone <your-repo-url> tikdismp-bot
cd tikdismp-bot
npm install
npm run build
```

### Step 9.5 — Create the .env file on the server

```bash
cp .env.example .env
nano .env   # fill in all your values, then Ctrl+O to save, Ctrl+X to exit
```

### Step 9.6 — Install PM2 and start

```bash
sudo npm install -g pm2

# Start the bot
pm2 start dist/index.js --name tikdismp-bot

# Save the process list so it survives reboots
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Copy and run the command it prints
```

### Useful PM2 Commands

```bash
pm2 status              # See running processes
pm2 logs tikdismp-bot   # View live logs
pm2 restart tikdismp-bot  # Restart the bot
pm2 stop tikdismp-bot     # Stop the bot
pm2 delete tikdismp-bot   # Remove from PM2
```

---

## 10. Deploying with Docker

Use this method for **Railway**, **Render**, or any Docker-compatible host.

### Step 10.1 — Build the Docker image

```bash
docker build -t tikdismp-bot .
```

### Step 10.2 — Run with your .env file

```bash
docker run --env-file .env -p 3000:3000 tikdismp-bot
```

### Step 10.3 — On Railway / Render

1. Push your code to a GitHub repository.
2. Connect the repo to Railway or Render.
3. Set all `.env` values as **Environment Variables** in the dashboard (never upload the `.env` file).
4. The platform will automatically:
   - Build the Docker image
   - Expose port 3000 (the health endpoint)
   - Keep the container running

> The `/health` endpoint at `http://your-host:3000/health` is used by Railway/Render to confirm the service is alive.

---

## 11. Troubleshooting

### Bot is online but slash commands don't appear

Slash commands for a specific guild register within seconds. Global registration takes up to 1 hour.

**Fix:** Kick the bot from your server and re-invite it, or wait up to 60 minutes.

---

### Error: "Missing required environment variable: X"

The bot exits immediately if any required variable is empty or missing.

**Fix:** Double-check your `.env` file. Make sure there are no quotes missing, no trailing spaces, and all required fields are filled.

---

### Error: "Aternos login failed: Invalid credentials"

The bot could not log in to Aternos.

**Fix:**
1. Verify `ATERNOS_USERNAME` and `ATERNOS_PASSWORD` are correct.
2. Try logging in manually at https://aternos.org to confirm your credentials work.
3. If Aternos sends a verification email, complete it first, then restart the bot.
4. If your account has 2FA enabled — the current bot does not support Aternos 2FA. Disable it on the Aternos account used by the bot.

---

### Error: "Could not read Aternos status label — selector may have changed"

The Aternos website updated its HTML structure and the CSS selectors broke.

**Fix:** Open [`src/config/selectors.ts`](./src/config/selectors.ts) and update the selector constants to match the new Aternos HTML. You can find the correct selectors using Chrome DevTools (F12 → right-click the element → Inspect → Copy selector).

Then rebuild: `npm run build` and restart.

---

### Puppeteer crashes with "No usable sandbox"

This happens on some Linux servers without proper Chrome sandbox configuration.

**Fix:** The `--no-sandbox` flag is already set in `PuppeteerAternosService.ts`. If it still fails, try running as root on the VPS (not recommended long-term) or use the Docker deployment instead.

---

### Dashboard message keeps getting created twice

The bot looks for a **pinned** message by the bot in the control channel on startup.

**Fix:**
1. Make sure the bot has **"Manage Messages"** permission in the control channel (needed to pin).
2. Delete all existing dashboard messages in the channel and restart the bot — it will create and pin a fresh one.

---

### Minecraft players show as empty even when online

`craftping` queries the server for the player list. Aternos may have **player list hiding** enabled, or the server uses a plugin that hides player names.

**Fix:** This is a server-side configuration. On the Aternos panel, check if `online-mode` and `enable-query` are enabled in `server.properties`.

---

### The bot works locally but not on Railway/Render

Make sure all environment variables are set in the platform's dashboard — the `.env` file is not uploaded to the server.

Also verify the platform exposes port `3000` and hits the `/health` endpoint successfully before marking the deployment as live.

---

## Permission Level Quick Reference

| Who | What to set |
|---|---|
| You (full control) | Add your User ID to `OWNER_USER_IDS` |
| Secondary admin | Add their User ID to `ADMIN_USER_IDS`, or a role ID to `ADMIN_ROLE_IDS` |
| Your 3 friends | Add their User IDs to `TRUSTED_USER_IDS` (comma-separated) |
| Everyone else in the server | Gets read-only access automatically |

---

*Setup guide for TikdiSMP Discord Manager Bot — built with discord.js v14, TypeScript, Puppeteer, and craftping.*
