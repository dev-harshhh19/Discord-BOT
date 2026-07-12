# Termux Deployment Guide

This document outlines the procedure for deploying and running the Aternos Server Manager natively on an Android device using Termux. 

By utilizing Termux, a virtual X11 display server (Xvfb), and a headless Chromium build, you can host the Discord bot 24/7 on an ARM-based mobile device without relying on external VPS or cloud hosting providers.

## 1. Prerequisites

1. **Install Termux**: Download the latest release exclusively from [F-Droid](https://f-droid.org/packages/com.termux/). The Google Play Store version is deprecated and unsupported.
2. **Disable Battery Optimization**: Modern Android operating systems will forcefully terminate background processes. 
   - Navigate to **Settings** -> **Apps** -> **Termux** -> **Battery**.
   - Set the battery usage to **Unrestricted** (or "Don't Optimize").

## 2. System Dependencies

Update the local package manager and install the required core utilities, Node.js environment, Chromium browser, and the X11 virtual frame buffer packages:

```bash
pkg update && pkg upgrade -y
pkg install nodejs git chromium make python x11-repo xvfb -y
```

*Note: It is strictly required to use the native Termux `chromium` package, as the default x86_64 Chromium binary bundled with Puppeteer is incompatible with ARM architecture.*

## 3. Clone Repository

Clone the source code to your local Termux environment:

```bash
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT
```

## 4. Safely Install Node Modules

To prevent Puppeteer from attempting to download the incompatible x86_64 Chromium binary during installation, set the skip flag when running `npm install`:

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install
```

## 5. Environment Configuration

Copy the template configuration file:

```bash
cp .env.example .env
```

Open the `.env` file using `nano` or `vim`:

```bash
nano .env
```

### Critical Chromium Configuration
You must append the exact absolute path of the Termux Chromium installation to your `.env` file. You must also ensure the browser runs in headful mode (which is handled securely via Xvfb) to bypass Aternos bot detection. Append the following lines to your `.env`:

```env
PUPPETEER_EXECUTABLE_PATH=/data/data/com.termux/files/usr/bin/chromium-browser
PUPPETEER_HEADLESS=false
```
*(If `/data/data/com.termux/files/usr/bin/chromium-browser` throws a "not found" error later, run `which chromium` in your terminal to find the exact binary path on your specific device).*

## 6. CPU Wakelock

If the device screen turns off, Android will suspend CPU execution. To ensure continuous operation, you must acquire a Termux wakelock.
- Pull down the Android notification shade.
- Locate the Termux ongoing notification.
- Tap **Acquire Wakelock**.

## 7. Execution

Launch the application using `xvfb-run`. This creates a virtual display buffer, allowing the Chromium browser to execute graphical operations strictly in the background without crashing due to Android's lack of a native X11 server.

```bash
xvfb-run --server-args="-screen 0 1024x768x24" npm run dev
```

---

## Troubleshooting: Phantom Process Killer (Android 12+)

Android 12 and newer versions implement an aggressive "Phantom Process Killer" that automatically terminates applications spawning excessive child processes (a common behavior of Chromium). 

If Termux unexpectedly closes after several hours, disable this behavior via ADB from a connected PC:

1. Enable **Developer Options** and **USB Debugging** on the Android device.
2. Connect the device to a PC via USB.
3. Open a terminal on the PC and execute:
   ```bash
   adb shell device_config put activity_manager max_phantom_processes 2147483647
   ```
This persistently disables the phantom process restriction for Termux.
