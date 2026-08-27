# 📱 Termux Deployment Guide (Android ARM64)

This guide provides a comprehensive, production-ready procedure for deploying the **TomMC-SMP Aternos Manager** natively on an Android device using Termux. 

By utilizing Termux, a virtual X11 display server (`Xvfb`), and an ARM-compiled headless Chromium build, you can host the Discord bot **24/7 at zero cost** on a spare Android device, completely bypassing expensive VPS fees.

---

## 1. Prerequisites & System Configuration

### 1.1 Install the correct Termux version
**Do NOT use the Google Play Store version.** It is deprecated, broken, and will fail to install Node.js packages.
* Download and install the latest version from **[F-Droid](https://f-droid.org/packages/com.termux/)**.

### 1.2 Prevent Android from killing the bot (Crucial)
Android aggressively terminates background applications to save power. You must explicitly whitelist Termux:
1. Open Android **Settings** → **Apps** → **Termux**.
2. Tap **Battery**.
3. Set the battery usage profile to **Unrestricted** (or **Don't optimize**).

### 1.3 Fix Android 12+ Phantom Process Killer (Optional but Recommended)
If you are on Android 12 or newer, the OS limits apps to 32 child processes. Chromium spawns many processes, and Android will randomly kill the bot after a few hours. 
To permanently fix this, connect your phone to a PC via USB and run this ADB command:
```bash
adb shell device_config put activity_manager max_phantom_processes 2147483647
```

---

## 2. Environment Setup

Open Termux and update the package repositories. We will install the required compilation tools, Node.js, and a native ARM64 build of Chromium.

```bash
# Update repositories and install X11 window system support
pkg update && pkg upgrade -y
pkg install x11-repo -y

# Install core dependencies and ARM Chromium
pkg install nodejs git chromium make python xvfb xauth -y
```

> ⚠️ **Why native Chromium?** 
> Standard Puppeteer attempts to download an `x86_64` (Windows/Linux PC) version of Chromium, which immediately crashes on Android ARM processors. We must use the Chromium package provided by Termux.

---

## 3. Installation

We have created a dedicated `termux` branch for this project. This branch replaces standard `puppeteer` with `puppeteer-core`—a stripped-down version that completely skips the broken x86 Chromium downloads, making installation instant and error-free.

```bash
# Clone the dedicated Android branch
git clone -b termux https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT

# Install dependencies (puppeteer-core will install instantly)
npm install

# Compile the TypeScript project
npm run build
```

---

## 4. Configuration

Copy the example configuration file:
```bash
cp .env.example .env
nano .env
```

Append the following Android-specific environment variables to the bottom of the `.env` file:
```env
# Tell Puppeteer where the native Termux ARM Chromium is located
PUPPETEER_EXECUTABLE_PATH=/data/data/com.termux/files/usr/bin/chromium-browser

# Run in headful mode (bypasses Cloudflare bot detection)
PUPPETEER_HEADLESS=false
```

*(Press `CTRL+O` to save, `Enter` to confirm, and `CTRL+X` to exit nano).*

---

## 5. Launching the Bot

Before launching, you **must acquire a Wakelock** to keep the CPU running while the screen is off:
1. Pull down your Android notification shade.
2. Find the **Termux** notification.
3. Tap **Acquire Wakelock**.

Start the bot inside a virtual display buffer using `xvfb-run` (this allows "headful" Chrome to run without an actual screen attached):

```bash
xvfb-run --server-args="-screen 0 1024x768x24" npm start
```

---

## 6. Troubleshooting & Fallbacks

### Issue 1: "The current platform is not supported" during `npm install`
**Cause:** You are on the `main` branch, which uses standard Puppeteer.
**Fix:** Switch to the termux branch and reinstall.
```bash
git checkout termux
rm -rf node_modules
npm install
```

### Issue 2: `xvfb-run: error: xauth command not found`
**Cause:** X11 authentication tools are missing.
**Fix:** Ensure you installed `xauth`.
```bash
pkg install xauth -y
```

### Issue 3: Chromium fails to launch / Path not found
**Cause:** The path to Chromium varies depending on your Termux installation.
**Fix:** Find the exact path by running:
```bash
which chromium
```
Then, update `PUPPETEER_EXECUTABLE_PATH` in your `.env` file with the exact output from that command.

### Issue 4: Bot runs out of memory (OOM Kill) or crashes frequently
**Cause:** Android devices with low RAM (under 4GB) might struggle with Chromium.
**Fix:** You can forcefully limit the Node.js memory footprint. Run the bot using this command instead:
```bash
xvfb-run -a node --max-old-space-size=128 dist/index.js
```
