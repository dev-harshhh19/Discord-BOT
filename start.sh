#!/usr/bin/env bash
# ==============================================================================
# TomMC-SMP Server Manager & Discord Bot — Startup Script
# Optimized for 1 vCPU / 2GB RAM Linux VPS (Ubuntu/Debian)
# Usage: chmod +x start.sh && ./start.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo "  Starting TomMC Minecraft Bot & Web Telemetry"
echo "=================================================="

# 1. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Please install Node.js (v20+ recommended)."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "[INFO] Using Node.js: $NODE_VERSION"

# 2. Check for .env file
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "[INFO] .env not found. Creating from .env.example..."
    cp .env.example .env
    echo "[WARNING] Please configure your .env file with your Discord & Aternos credentials!"
    exit 1
  else
    echo "[ERROR] .env file is missing."
    exit 1
  fi
fi

# 3. Create required runtime directories
mkdir -p data logs

# 4. Check dependencies
if [ ! -d "node_modules" ]; then
  echo "[INFO] node_modules not found. Installing dependencies..."
  npm ci || npm install
fi

# 5. Build TypeScript if dist/index.js is missing or if requested
if [ ! -f "dist/index.js" ] || [ "${1:-}" = "--build" ] || [ "${1:-}" = "build" ]; then
  echo "[INFO] Compiling TypeScript bundle (npm run build)..."
  npm run build
fi

# 6. Memory optimizations for 1 vCPU / 2GB RAM VPS
export NODE_ENV="${NODE_ENV:-production}"
export PUPPETEER_LOW_MEMORY="${PUPPETEER_LOW_MEMORY:-true}"

# 7. Check if running with Xvfb (virtual display for headless browser if needed on Linux)
if command -v xvfb-run >/dev/null 2>&1 && [ "${USE_XVFB:-true}" = "true" ]; then
  echo "[INFO] Starting with xvfb-run (virtual display buffer)..."
  exec xvfb-run -a node --max-old-space-size=512 dist/index.js
else
  echo "[INFO] Starting Node.js process directly..."
  exec node --max-old-space-size=512 dist/index.js
fi
