# Deployment Guide

## Prerequisites
- Node.js ≥ 20, Bun ≥ 1.3, FFmpeg ≥ 6 (libx264 + aac), DejaVu Sans Bold font

## Steps

### 1. Install
```bash
bun install
```

### 2. Configure
```bash
cp .env.example .env
# Generate secrets:
#   openssl rand -base64 32                              # NEXTAUTH_SECRET
#   bun run scripts/hash-password.ts <your-password>     # ALO_ADMIN_PASSWORD_HASH
```

Set in `.env`:
- `DATABASE_URL` — your DB
- `NEXTAUTH_SECRET` — from openssl
- `NEXTAUTH_URL` — your public URL
- `ALO_ADMIN_EMAIL` — admin login
- `ALO_ADMIN_PASSWORD_HASH` — from hash-password script
- (optional) `LIPSYNC_SERVICE_URL` — your Wav2Lip endpoint
- (optional) `CRON_SECRET` — for recovery sweep cron

### 3. Migrate
```bash
bun run db:migrate:deploy
bun run db:generate
```

### 4. Build
```bash
bun run build:prod
```

### 5. Run
```bash
bun run start:prod
# OR with PM2:
pm2 start "NODE_ENV=production node .next/standalone/server.js" --name alo
```

### 6. Cron recovery sweep (recommended)
```cron
*/5 * * * * curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  "https://your-domain/api/recovery/sweep?timeoutMinutes=10"
```

### 7. (Optional) Deploy lip-sync GPU service
Deploy Wav2Lip/SadTalker on a GPU box accepting:
```
POST /predict  multipart/form-data: image=<png>, audio=<wav>
Response: video/mp4 binary
```
Set `LIPSYNC_SERVICE_URL=http://gpu-box:8080/predict`.

## Verification
```bash
curl https://your-domain/api/health
# Create avatar + generate video + ffprobe for audio+video
```
