# ALO Learning Journey — Production Deployment Guide

## Prerequisites
- Node.js 22+ / Bun 1.3+
- SQLite (or MySQL for production)
- Caddy or Nginx (reverse proxy)
- PM2 (process manager)
- FFmpeg + espeak (for video/TTS features)

## Local Development
```bash
bun install
cp .env.example .env  # Edit with your values
bunx prisma generate
bunx prisma db push
bun run dev  # Starts on port 3000
```

## Production Build
```bash
bun install --frozen-lockfile
bunx prisma generate
bunx prisma db push
bun run build
```

## Production Start
```bash
PORT=3017 NODE_ENV=production bun .next/standalone/server.js
# Or with PM2:
pm2 start ecosystem.config.js
```

## VPS Deployment via GitHub Actions
1. Set GitHub Secrets:
   - VPS_HOST: your server IP
   - VPS_USER: SSH username
   - VPS_SSH_KEY: SSH private key
   - VPS_APP_PATH: /home/aloedu/learn-app
2. Push to main branch
3. GitHub Actions auto-deploys

## Health Check
```bash
curl http://localhost:3017/api/health
# Expected: {"status":"PARTIAL","checks":[...]}
```

## Rollback
```bash
cd /home/aloedu/learn-app
git checkout PREVIOUS_COMMIT_SHA
bun install --frozen-lockfile
bunx prisma generate
bun run build
pm2 restart alo-learning-journey
```

## Environment Variables
See `.env.example` for all required variables.
Never commit `.env` files to Git.
