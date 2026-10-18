# ALO Learning Journey — Production Deployment

## VPS Requirements
- Ubuntu/Hostinger Server (Node.js 22)
- MySQL 8
- Redis
- PM2
- Caddy (reverse proxy)
- FFmpeg + espeak (for video/TTS features)

## Environment Variables (set on VPS .env)
```
NODE_ENV=production
PORT=3017
DATABASE_URL=mysql://user_learn:PASSWORD@127.0.0.1:3306/db_learn
NEXTAUTH_URL=https://learn.aloeducation.com
NEXTAUTH_SECRET=GENERATE_32_CHAR_RANDOM
JWT_SECRET=GENERATE_32_CHAR_RANDOM
OPENAI_API_KEY=sk-your-key
AI_MODEL=gpt-4o-mini
REDIS_URL=redis://127.0.0.1:6379
UPLOAD_DIR=/home/aloedu/storage/uploads
N8N_WEBHOOK_URL=https://n8n.alolabs.net/webhook
EMAIL_FROM=noreply@aloeducation.com
RESEND_API_KEY=re_your-key
LOG_LEVEL=error
```

## Deployment Steps
1. Push to GitHub main branch
2. GitHub Actions auto-deploys to VPS via SSH
3. Or manually run: `bash scripts/deploy-vps.sh`
4. Verify: `bash scripts/health-check.sh`

## Rollback
```bash
pm2 stop alo-learning-journey
rm -rf .next
cp -r /tmp/alo-next-backup-LATEST .next
pm2 restart alo-learning-journey
```

## Database Migrations
- Safe: `npx prisma migrate deploy`
- NEVER: `npx prisma migrate reset` or `npx prisma db push --accept-data-loss`
