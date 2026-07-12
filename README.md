<div align="center">

# Aternos Server Manager

[![GitHub stars](https://img.shields.io/github/stars/dev-harshhh19/Discord-BOT?style=flat-square)](https://github.com/dev-harshhh19/Discord-BOT/stargazers)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)](#)
[![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=flat-square&logo=discord&logoColor=white)](#)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=flat-square&logo=puppeteer&logoColor=white)](#)

A production-grade TypeScript Discord bot that controls Aternos-hosted Minecraft servers programmatically. Built by [Harshad](https://github.com/dev-harshhh19).

</div>

## Overview

Aternos does not provide a public API for starting or managing free Minecraft servers. Standard Discord bots are incapable of controlling them natively.

This project solves that limitation by engineering a headless browser system that bypasses bot protections, injects session cookies, and hijacks internal AJAX requests to fully control the server programmatically. It is specifically optimized to run efficiently on an ARM-based Android device via Termux, providing a zero-cost 24/7 hosting solution.

## Core Capabilities

- **Stealth Automation:** Utilizes `puppeteer-extra-plugin-stealth` to navigate Cloudflare and AdBlock detectors.
- **AJAX Hijacking:** Directly interfaces with the Aternos internal API (e.g., `/ajax/server/confirm-queue`) using active session tokens (`SEC` and `TOKEN`) extracted from the live browser DOM.
- **Mobile Native (Termux):** Optimized for ARM processors. Patches Chromium Zygote crashes using `xvfb-run`, `--no-zygote`, and `--single-process`.
- **Self-Healing Queue:** Automatically monitors queue position, confirms queue prompts, and triggers a full restart cycle if stalled for more than 10 minutes.
- **Direct Protocol Query:** Pings the Minecraft server directly via `craftping` for real-time player telemetry, bypassing Aternos UI latency.
- **Role-Based Access Control:** A strict 4-tier permission system (Owner, Admin, Trusted, Everyone) integrated natively with Discord slash commands.
- **Live Dashboard:** An auto-updating Discord embed providing a control panel to manage the server state.

## Installation

### Termux (Android) Deployment
To run this bot natively on an Android device without cloud hosting, follow the mobile deployment guide:
[Read the Termux Installation Guide (TERMUX_GUIDE.md)](./TERMUX_GUIDE.md)

### Standard Deployment (PC / Server)

1. Clone the repository:
```bash
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```
Populate the `.env` file with your Discord Application credentials and Aternos session details.

3. Start the application:
```bash
npm run dev
```

## Available Commands

| Command | Description | Required Access |
|---------|-------------|-----------------|
| `/start` | Initiates the Aternos server boot sequence | Trusted+ |
| `/stop` | Shuts down the server | Admin+ |
| `/restart` | Force kills and restarts the instance | Owner Only |
| `/status` | Displays live server status and queue telemetry | Everyone |
| `/players` | Lists currently online players | Everyone |
| `/ping` | Measures bot and gateway latency | Everyone |

## Architecture

The project strictly follows a clean architecture pattern to separate infrastructure concerns (browser automation) from presentation (Discord commands):

```
src/
  ├── config/          # Environment validation and UI selectors
  ├── types/           # Global TypeScript interfaces
  ├── infrastructure/  # Puppeteer automation, craftping, Winston logging
  ├── application/     # StatusMonitor engine and state management
  ├── presentation/    # Discord slash commands and UI components
  └── utils/           # Permission validation and error handling
```

## Disclaimer

**Disclaimer:** This project is in no way affiliated with, authorized, maintained, sponsored or endorsed by Aternos or any of its affiliates or subsidiaries. This is an independent and unofficial software provided for educational purposes only. Use at your own risk.
