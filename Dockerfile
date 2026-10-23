# ==============================================================================
# TomMC-SMP Bot - Production Multi-Arch Dockerfile
# Optimized for 1 vCPU & 2GB RAM Cloud VPS, Docker, and Container Environments
# ==============================================================================

# ------------------------------------------------------------------------------
# Build Stage: Compile TypeScript to CJS bundle
# ------------------------------------------------------------------------------
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
ENV PORT=3000
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_HEADLESS=false
ENV PUPPETEER_LOW_MEMORY=true

# Install native Chromium, dumb-init, xvfb (virtual X11 display), and essential fonts/libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    xauth \
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

# Expose Web Dashboard & Telemetry port (default 3000)
EXPOSE 3000

# Use dumb-init to properly handle UNIX process signals and reap zombie Chromium forks
ENTRYPOINT ["dumb-init", "--"]

# Start the compiled bot with Xvfb virtual display
# Node V8 heap capped to 384MB to prevent out-of-memory crashes on 2GB RAM VPS
CMD ["xvfb-run", "-a", "node", "--max-old-space-size=384", "dist/index.js"]
