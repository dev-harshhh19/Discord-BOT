#!/usr/bin/env bash
# ==============================================================================
# 1-Click Deployment Script for 1 vCPU / 2GB RAM VPS
# Usage: chmod +x deploy.sh && ./deploy.sh
# ==============================================================================

set -euo pipefail

echo "=================================================="
echo "  Deploying TomMC Minecraft Bot & Web Telemetry   "
echo "  Target: 1 vCPU / 2GB RAM VPS Environment       "
echo "=================================================="

# Check if .env exists
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please configure your .env file with your Discord & Aternos credentials!"
    exit 1
  else
    echo "Error: .env file is missing."
    exit 1
  fi
fi

# Ensure data and log directories exist with appropriate permissions
mkdir -p data logs
chmod 777 data logs 2>/dev/null || true

# Check docker compose availability
if command -v docker &> /dev/null; then
  echo "Building and launching container locally via Docker Compose..."
  docker compose up -d --build
  echo ""
  echo "Container started successfully!"
  echo "Web Dashboard available on: http://$(curl -s ifconfig.me || echo 'YOUR_VPS_IP'):3000"
  echo "Check container logs with: docker compose logs -f"
else
  echo "Error: Docker is not installed on this system."
  echo "Install docker with: curl -fsSL https://get.docker.com | sh"
  exit 1
fi
