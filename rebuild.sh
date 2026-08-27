#!/bin/bash

# Ensure we exit if any command fails
set -e

echo "🛑 Stopping existing Docker containers..."
docker compose down || docker-compose down

echo "🏗️  Rebuilding the Docker image..."
# Use --pull to ensure we get the latest base images, and --no-cache if you want a totally fresh build
docker compose build || docker-compose build

echo "🚀 Starting Docker containers in detached mode..."
docker compose up -d || docker-compose up -d

echo "✅ Deployment complete! Checking status..."
docker compose ps || docker-compose ps
