# ALO Learning Journey — Production Dockerfile (multi-stage)
# Built for Ubuntu 24.04+ hosts. Uses Bun for install, Node for runtime.

# ---- Stage 1: deps ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Stage 2: build ----
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Required binaries for the build/runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN bunx prisma generate
RUN bun run build:prod

# ---- Stage 3: runtime ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3017
ENV HOSTNAME=0.0.0.0

# Runtime system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/* && \
    useradd -r -u 1001 -g root alo

# Copy standalone server + static + public
COPY --from=builder --chown=alo:root /app/.next/standalone ./
COPY --from=builder --chown=alo:root /app/.next/static ./.next/static
COPY --from=builder --chown=alo:root /app/public ./public
COPY --from=builder --chown=alo:root /app/prisma ./prisma
COPY --from=builder --chown=alo:root /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=alo:root /app/node_modules/@prisma ./node_modules/@prisma

# Storage volumes (mounted at runtime)
RUN mkdir -p /app/db /app/storage && chown -R alo:root /app/db /app/storage
VOLUME ["/app/db", "/app/storage", "/app/public/avatars", "/app/public/avatar-videos", "/app/public/avatar-audio", "/app/public/avatar-scenes", "/app/public/avatar-thumbs"]

USER alo
EXPOSE 3017
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3017/api/health || exit 1

CMD ["node", "server.js"]
