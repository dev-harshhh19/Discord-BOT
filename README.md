<div align="center">
  
# 🎮 Aternos Server Manager (Discord Bot)
**A stealth automation engine to control Aternos Minecraft servers via Discord, running 24/7 on Android/Termux.**

[![GitHub stars](https://img.shields.io/github/stars/dev-harshhh19/Discord-BOT?style=social)](https://github.com/dev-harshhh19/Discord-BOT/stargazers)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](#)
[![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)](#)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)](#)

*Built by [Harshad](https://github.com/dev-harshhh19)*

<img src="https://capsule-render.vercel.app/api?type=waving&color=timeGradient&height=150&section=header" width="100%">

</div>

## 💡 The Concept

Aternos does not provide a public API for starting or managing free Minecraft servers. Standard bots cannot control it.

**This project solves that by engineering a stealth headless browser system.** It bypasses bot protections, injects session cookies, and hijacks internal AJAX requests to fully control the server programmatically. 

Even better? **It's designed to run entirely on a spare Android phone via Termux.** No VPS, no cloud hosting, no monthly fees. 

## ✨ Key Features

- 🕵️ **Stealth Automation:** Uses `puppeteer-extra-plugin-stealth` to bypass Cloudflare and AdBlock detectors.
- 📡 **AJAX Hijacking:** Directly interfaces with Aternos internal API (`/ajax/server/confirm-queue`) using stolen session keys (`SEC` and `TOKEN`) from the live browser DOM.
- 📱 **Mobile Native (Termux):** Optimized for ARM processors. Fixes Chromium Zygote crashes using `xvfb-run`, `--no-zygote`, and `--single-process`.
- 🔁 **Self-Healing Queue:** Automatically monitors queue position, confirms queue prompts, and triggers a full restart cycle if stuck in the queue for >10 minutes.
- 🏓 **Direct MC Protocol:** Pings the Minecraft server via `craftping` to get real-time player counts without relying on Aternos' UI status.
- 🔐 **Role-Based Access Control:** 4-tier permission system (Owner, Admin, Trusted, Everyone) natively mapped to Discord slash commands.
- 📊 **Live Dashboard:** An auto-updating Discord embed providing a control panel to Start, Stop, and Refresh the server.

---

## 🚀 Quick Setup (Android / Termux)

Want to run this bot for free on your phone? Check out the dedicated guide:
👉 **[Read the Termux Installation Guide (TERMUX_GUIDE.md)](./TERMUX_GUIDE.md)**

## 💻 Standard Setup (PC / Server)

### 1. Clone & Install
```bash
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT
npm install
```

### 2. Environment Variables
Create a `.env` file and fill in your credentials.
```bash
cp .env.example .env
```
*(You will need your Discord Bot Token, Client ID, and Aternos Login).*

### 3. Start the Bot
```bash
npm run dev
```

---

## 🛠️ Slash Commands

| Command | Description | Permission Level |
|---------|-------------|-----------------|
| `/start` | Boots the Aternos server | Trusted+ |
| `/stop` | Shuts down the server safely | Admin+ |
| `/restart` | Force kills and restarts | Owner Only |
| `/status` | Shows live server status & queue | Everyone |
| `/players` | Lists online players | Everyone |
| `/ping` | Bot network latency | Everyone |

---

<div align="center">
  
**Love this project? Give it a ⭐ on GitHub to show your support!**

<img src="https://capsule-render.vercel.app/api?type=waving&color=timeGradient&height=150&section=footer" width="100%">

</div>
