# Running the Bot on Termux (Android)

Hosting your Discord Bot on a spare or active Android phone via Termux is an excellent, cost-free alternative to a VPS! Since this bot relies on Puppeteer (a headless Chromium browser) to automate Aternos, there are a few unique steps to get it running smoothly on an ARM processor.

Follow these steps exactly to set up and run the bot successfully on your mobile device.

## Prerequisites

1. **Install Termux**: Download the latest version of Termux from [F-Droid](https://f-droid.org/packages/com.termux/). Do NOT download it from the Google Play Store (it is outdated and no longer supported).
2. **Battery Optimization**: You must allow Termux to run in the background.
   * Go to your phone's **Settings** -> **Apps** -> **Termux** -> **Battery**.
   * Set it to **Unrestricted** (or "Don't Optimize").

## Step 1: Install Dependencies in Termux

Open Termux and run the following commands to update the system and install the required packages:

`ash
pkg update && pkg upgrade -y
pkg install nodejs git chromium make python -y
`
*Note: We specifically install chromium from Termux's repository because Puppeteer's default x86_64 Chromium binary will not work on Android's ARM architecture.*

## Step 2: Clone Your Repository

Next, download your code from GitHub:

`ash
git clone https://github.com/dev-harshhh19/Discord-BOT.git
cd Discord-BOT
`

## Step 3: Install Node Modules Safely

Because Puppeteer will try to download its incompatible x86_64 version of Chromium during installation, we need to set an environment variable to skip that download.

Run this command inside the Discord-BOT directory:

`ash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install
`

## Step 4: Configure Your Environment

Create your .env file just like you would on a PC:

`ash
cp .env.example .env
nano .env
`
*(Fill in your Discord Token and Aternos credentials. Press CTRL + X, then Y, then Enter to save and exit).*

**CRITICAL STEP for Termux:**
You must tell Puppeteer to use the native Chromium browser we installed in Step 1. Add this exact line to the bottom of your .env file:

`env
PUPPETEER_EXECUTABLE_PATH=/data/data/com.termux/files/usr/bin/chromium-browser
`

## Step 5: Acquire a Wakelock (Keep the Bot Alive)

If you turn off your phone screen, Android will eventually put the CPU to sleep, disconnecting your bot from Discord. To prevent this, Termux has a built-in feature called a "wakelock".

Pull down your Android notification shade, find the Termux notification, and click **Acquire Wakelock**. 

*(Alternatively, you can run 	ermux-wake-lock in the terminal).*

## Step 6: Start the Bot

Finally, run the bot!

`ash
npm run dev
`
*(Or 
pm run build followed by 
pm start if you prefer to run the compiled version).*

---

## Advanced: Android 12+ "Phantom Process Killer"

If you are on Android 12, 13, or 14, Android has an incredibly aggressive "Phantom Process Killer" that will automatically terminate Termux if it uses too much CPU or spawns too many child processes (which Chromium does). 

If you notice the bot randomly crashing or Termux closing itself after a few hours, you will need to disable the phantom process killer using ADB from a PC.

1. Enable **Developer Options** and **USB Debugging** on your phone.
2. Connect your phone to a PC.
3. Open a terminal/command prompt on the PC and run:
   `ash
   adb shell device_config put activity_manager max_phantom_processes 2147483647
   `
This permanently stops Android from killing your background Termux session.
