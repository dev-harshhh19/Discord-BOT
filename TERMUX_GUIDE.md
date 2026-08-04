# Termux Deployment Guide

This document outlines the procedure for deploying and running the Aternos Server Manager natively on an Android device using Termux.

By utilizing Termux, a virtual X11 display server (Xvfb), and a headless Chromium build, you can host the Discord bot 24/7 on an ARM-based Android device without relying on a VPS or cloud hosting provider.

---

## 1. Prerequisites

### Install Termux

Download the latest version from **F-Droid**.

> **Important**
> The Google Play Store version of Termux is deprecated and no longer maintained.

https://f-droid.org/packages/com.termux/

### Disable Battery Optimization

Android may terminate background applications to save power.

1. Open **Settings** → **Apps** → **Termux**
2. Open **Battery**
3. Set battery usage to **Unrestricted** (or **Don't optimize**)

---

## 2. Install Dependencies

Update packages and install the required dependencies:

```bash
pkg update && pkg upgrade -y
pkg install x11-repo -y
pkg install nodejs git chromium make python xvfb -y
```

> **Note**
>
> You **must** use the Termux `chromium` package.
>
> Puppeteer's bundled Chromium is built for x86_64 and is incompatible with Android ARM devices.

---

## 3. Clone the Repository

```bash
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT
```

---

## 4. Install Node Modules

Prevent Puppeteer from downloading its incompatible Chromium binary:

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install

# Build the TypeScript project
npm run build
```

---

## 5. Configure Environment Variables

Copy the example configuration:

```bash
cp .env.example .env
```

Open the file:

```bash
nano .env
```

Append the following values:

```env
PUPPETEER_EXECUTABLE_PATH=/data/data/com.termux/files/usr/bin/chromium-browser
PUPPETEER_HEADLESS=false
```

> **If Chromium isn't found**
>
> Run:
>
> ```bash
> which chromium
> ```
>
> Then replace the value of `PUPPETEER_EXECUTABLE_PATH` with the returned path.

---

## 6. Acquire a Wakelock

Android suspends CPU execution when the device sleeps.

To keep the bot running:

1. Pull down the notification shade.
2. Find the **Termux** notification.
3. Tap **Acquire Wakelock**.

---

## 7. Start the Bot

Launch the application with a virtual X11 display:

```bash
xvfb-run --server-args="-screen 0 1024x768x24" npm run dev
```

`xvfb-run` creates a virtual display that allows Chromium to run in headful mode without requiring a physical display or Android X11 server.

---

# Troubleshooting

## Android 12+ Phantom Process Killer

Android 12 and later include a **Phantom Process Killer** that may terminate Chromium after several hours because it spawns many child processes.

If Termux unexpectedly exits, you can disable this behavior using ADB.

### Enable Developer Options

- Enable **Developer Options**
- Enable **USB Debugging**

### Connect Your Device

Connect the phone to a computer via USB.

### Run

```bash
adb shell device_config put activity_manager max_phantom_processes 2147483647
```

This disables the Phantom Process limit and prevents Android from terminating Chromium-based processes.

---

## Notes

- Keep **Battery Optimization** disabled for Termux.
- Always acquire a **Wakelock** before starting the bot.
- Use the **Termux Chromium** package instead of Puppeteer's bundled Chromium.
- If Chromium cannot be found, verify its location with:

```bash
which chromium
```
