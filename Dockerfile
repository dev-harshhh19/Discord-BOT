# ==============================================================================
# TikdiSMP Bot - Production Multi-Arch Dockerfile
# Compatible with x86_64 (amd64), ARM64 (aarch64 / Raspberry Pi / Oracle ARM),
# VPS, Home Cloud, and Termux/PRoot Linux container environments.
# ==============================================================================

# Build Stage: Compile TypeScript to CJS bundle
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Prevent Puppeteer from downloading bundled Chromium during build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
COPY public/ ./public/

RUN npm run build

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install native Chromium, dumb-init, and essential system fonts/libraries
# Debian Bookworm provides native 'chromium' for both amd64 and arm64.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    dumb-init \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Copy package definition and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application and web public assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create data directory for browser sessions and mutex locks
RUN mkdir -p /app/data /app/logs

# Create a secure, non-privileged system user for running Puppeteer
RUN groupadd -g 10001 botgroup && \
    useradd -u 10001 -g botgroup -s /bin/bash -m botuser && \
    chown -R botuser:botgroup /app

# Switch to non-root user
USER botuser

# Expose Web Dashboard & Telemetry port
EXPOSE 5176

# Use dumb-init to properly handle UNIX process signals and reap zombie Chromium forks
ENTRYPOINT ["dumb-init", "--"]

# Start the compiled bot
CMD ["node", "dist/index.js"]
