# ALO Learning Journey cPanel Edition

Admin-only PHP 8.2 + MySQL application for `learn.aloeducation.com`.

## What runs immediately
- Secure admin login
- Soft baby/parenting dashboard
- Topic idea generation with OpenAI when configured, otherwise safe local fallback ideas
- Content package generation
- Safety review and quality score
- All common image-size placeholder exports
- Admin approval queue
- Publishing job queue
- Telegram commands and daily report
- Audit logs, emergency stop and database backup cron

## Important reality
Social networks do not allow a package to obtain passwords, OTPs or access tokens automatically. Connect each account through its official OAuth flow. Meta, YouTube and TikTok may require app review or verification before production publishing. The included app never pretends a failed or unconfigured post succeeded.

## cPanel deployment
1. Create subdomain `learn.aloeducation.com`.
2. Upload the private folder to `/home/aloeduca/learn-app`.
3. Point the subdomain document root to `/home/aloeduca/learn-app/public`.
4. Copy `.env.example` to `.env` and fill database values.
5. Generate secrets:
   `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`
6. Visit:
   `https://learn.aloeducation.com/install?key=YOUR_ADMIN_SETUP_KEY`
7. Create the admin, then block/delete the install folder.
8. Set PHP 8.2 or 8.3 and enable PDO MySQL, cURL, OpenSSL, Sodium, GD, mbstring and fileinfo.

## Cron examples
- `*/15 * * * * /usr/local/bin/php /home/aloeduca/learn-app/cron/publish.php`
- `0 8 * * * /usr/local/bin/php /home/aloeduca/learn-app/cron/trends.php`
- `0 9 * * * /usr/local/bin/php /home/aloeduca/learn-app/cron/content.php`
- `0 10 * * * /usr/local/bin/php /home/aloeduca/learn-app/cron/report.php`
- `0 3 * * 0 /usr/local/bin/php /home/aloeduca/learn-app/cron/backup.php`

## Telegram webhook
Set:
`https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://learn.aloeducation.com/telegram/webhook&secret_token=<WEBHOOK_SECRET>`

## Family identity assets
Place guardian-approved reference images under:
- `storage/uploads/family/child-reference.jpg`
- `storage/uploads/family/mother-reference.jpg`
- `storage/uploads/family/father-reference.jpg`

The production image/video provider must use consented references and its own identity-consistency features. Do not clone a real person's face or voice without documented consent.

## Platform media sizes
- Facebook feed: 1200×630
- Instagram square: 1080×1080
- Reels, Shorts, TikTok, WhatsApp Status: 1080×1920
- YouTube thumbnail: 1280×720
- LinkedIn: 1200×627
- X: 1600×900
