# ALO Labs MarketingOS — Full Copy-Paste Guideline

**Live PR/Release:** https://github.com/engralaminn-collab/MarketingOS/releases/tag/phase-0-voice-contact-center-audit
**Repository:** https://github.com/engralaminn-collab/MarketingOS
**Main branch:** `main` (commit `c797685`)
**Date:** 2026-11-05

---

## 1. How to view the Phase 0 audit (live now)

The 6 audit documents are live on GitHub. Open any of these links:

```
https://github.com/engralaminn-collab/MarketingOS/blob/main/docs/voice-contact-center/AUDIT.md
https://github.com/engralaminn-collab/MarketingOS/blob/main/docs/voice-contact-center/TELEPHONY_ARCHITECTURE.md
https://github.com/engralaminn-collab/MarketingOS/blob/main/docs/voice-contact-center/BANGLA_VOICE_MODEL_EVALUATION.md
https://github.com/engralaminn-collab/MarketingOS/blob/main/docs/voice-contact-center/PROVIDER_COMPATIBILITY.md
https://github.com/engralaminn-collab/MarketingOS/blob/main/docs/voice-contact-center/SECURITY_AND_COMPLIANCE.md
https://github.com/engralaminn-collab/MarketingOS/blob/main/docs/voice-contact-center/IMPLEMENTATION_ROADMAP.md
```

Or clone locally:

```bash
git clone https://github.com/engralaminn-collab/MarketingOS.git
cd MarketingOS
ls docs/voice-contact-center/
```

---

## 2. How to approve or reject Phase 1 (copy-paste template)

Reply to this conversation with one of the following:

### ✅ Option A — Approve Phase 1

```
APPROVE Phase 1

I have reviewed the 6 audit documents at docs/voice-contact-center/.
I approve Phase 1 (Platform Foundation) to begin on a feature branch.

Approved scope:
- Tenant architecture (application-layer companyId)
- RBAC + MFA for privileged accounts (TOTP)
- Refresh token rotation + idle/absolute timeouts
- Voice agent registry (extends AiAgent)
- Usage metering (calls, TTS, ASR per-tenant per-day)
- Audit log extensions (voice-specific event types)
- Provider adapters (Twilio, Telnyx, FreeSWITCH)

Constraints:
- Use feature branch: feature/voice-contact-center-phase-1
- No destructive migrations
- No production deployment without separate approval
- Preserve all existing functionality
- Run all existing tests (127/127 must still pass)
```

### ✏️ Option B — Approve with changes

```
APPROVE WITH CHANGES

Reviewed audit. Approve Phase 1 with the following revisions:
- [list sections to revise]
- [list constraints to change]
```

### ❌ Option C — Reject

```
REJECT

The following deal-breakers must be resolved before Phase 1:
- [list deal-breakers]
```

---

## 3. How to deploy MarketingOS to a fresh Ubuntu server (copy-paste)

### 3.1 Prerequisites

```bash
# Ubuntu 22.04 or 24.04 LTS
# Minimum: 2 vCPU, 4 GB RAM, 40 GB disk
# Recommended: 4 vCPU, 8 GB RAM, 100 GB SSD

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools
sudo apt install -y build-essential python3 git curl jq

# Install Caddy (reverse proxy + auto HTTPS)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

### 3.2 Clone + build

```bash
# Clone the repository
cd /opt
sudo mkdir -p marketingos && sudo chown $USER:$USER marketingos
git clone https://github.com/engralaminn-collab/MarketingOS.git marketingos
cd marketingos

# Install dependencies
npm ci

# Generate required secrets
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "VAULT_MASTER_KEY=$(openssl rand -base64 32)"
echo "ADMIN_SEED_PASSWORD=$(openssl rand -base64 24)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo "PUSH_SECRET=$(openssl rand -hex 32)"

# Copy these values into .env (see section 3.3 below)
```

### 3.3 Configure `.env`

```bash
cp .env.example .env
nano .env
```

Paste this template (fill in the secrets you generated above):

```bash
# ═══ REQUIRED (app will not start without these) ═══
DATABASE_URL="file:./db/custom.db"
JWT_SECRET="<paste-your-jwt-secret-here>"
VAULT_MASTER_KEY="<paste-your-vault-master-key-here>"
ADMIN_SEED_EMAIL="admin@alolabs.net"
ADMIN_SEED_PASSWORD="<paste-your-admin-seed-password-here>"

# ═══ RUNTIME ═══
NODE_ENV="production"
PORT="3055"
HOSTNAME="0.0.0.0"

# ═══ SITE IDENTITY ═══
NEXT_PUBLIC_SITE_URL="https://marketing.alolabs.net"
NEXT_PUBLIC_APP_URL="https://marketing.alolabs.net"

# ═══ CRON (for scheduled post publishing) ═══
CRON_SECRET="<paste-your-cron-secret-here>"

# ═══ PUSH (realtime service) ═══
PUSH_SECRET="<paste-your-push-secret-here>"

# ═══ FREE AI PROVIDERS (optional but recommended — all free) ═══
# Get free keys at:
#   Groq:      https://console.groq.com/keys
#   Gemini:    https://aistudio.google.com/app/apikey
#   OpenRouter: https://openrouter.ai/keys
#   Cloudflare: https://dash.cloudflare.com/profile/api-tokens
#   HuggingFace: https://huggingface.co/settings/tokens
GROQ_API_KEY=""
GEMINI_API_KEY=""
OPENROUTER_API_KEY=""
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_API_TOKEN=""
HF_API_TOKEN=""

# ═══ SMS PROVIDERS (pick one — all optional, simulation fallback if unset) ═══
# Twilio (paid, pay-per-message):
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM_NUMBER=""
# httpSMS (free — Android phone as gateway):
HTTPSMS_API_KEY=""
HTTPSMS_FROM_NUMBER=""
# Telnyx (paid, lower than Twilio):
TELNYX_API_KEY=""
TELNYX_CONNECTION_ID=""
TELNYX_FROM_NUMBER=""
# sms.domovina.ai (self-hosted, free):
DOMOVINA_SMS_API_URL=""
DOMOVINA_SMS_API_KEY=""

# ═══ SOCIAL PUBLISHING (Postiz — self-hosted, AGPL-3.0) ═══
# Deploy Postiz via Docker: https://github.com/gitroomhq/postiz-app
POSTIZ_BASE_URL=""
POSTIZ_API_KEY=""
POSTIZ_WORKSPACE_ID=""

# ═══ LOCAL AI (optional — self-hosted, free) ═══
# Install Ollama: curl -fsSL https://ollama.com/install.sh | sh
# Pull models: ollama pull llama3.2 bge-m3
OLLAMA_API_KEY=""
```

### 3.4 Build + seed + start

```bash
# Generate Prisma client
npx prisma generate

# Sync database schema (SQLite for staging; PostgreSQL for production)
npx prisma db push --skip-generate

# Seed admin user + AI model registry
npx tsx prisma/seed.ts
npx tsx prisma/seed-ai-models.ts

# Production build
npm run build

# Copy static assets to standalone output
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

# Start the server
cd .next/standalone
node server.js
```

### 3.5 Configure Caddy (auto-HTTPS)

```bash
sudo nano /etc/caddy/Caddyfile
```

Paste:

```
marketing.alolabs.net {
    reverse_proxy 127.0.0.1:3055
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

### 3.6 Configure PM2 (process manager)

```bash
sudo npm install -g pm2

cd /opt/marketingos
pm2 start "node .next/standalone/server.js" --name marketingos
pm2 save
pm2 startup
# Run the command PM2 prints to enable auto-restart on boot
```

### 3.7 Configure cron (for scheduled post publishing)

```bash
# Edit crontab
crontab -e

# Add this line to publish scheduled posts every minute:
* * * * * curl -s -H "Authorization: Bearer <your-cron-secret>" https://marketing.alolabs.net/api/cron/social-publish > /dev/null 2>&1
```

### 3.8 Verify deployment

```bash
# Health check
curl https://marketing.alolabs.net/api/health

# Login (use the ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD from .env)
curl -X POST https://marketing.alolabs.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@alolabs.net","password":"<your-admin-seed-password>"}'
```

---

## 4. How to run the test suite (copy-paste)

```bash
cd /opt/marketingos

# All 4 test suites (127 assertions total)
npx tsx scripts/verify-login.ts
npx tsx scripts/test-integrations.ts
npx tsx scripts/test-ollama-cloud.ts
npx tsx scripts/test-sms-providers.ts

# Expected output:
# All login-path checks passed.          (4 assertions)
# 36 passed, 0 failed                   (test-integrations)
# 63 passed, 0 failed                   (test-ollama-cloud)
# 24 passed, 0 failed                   (test-sms-providers)
```

---

## 5. How to set up the free AI providers (copy-paste)

All providers below are **FREE**. Pick any subset — the chain skips unconfigured providers automatically.

### 5.1 Z.AI (already configured — no action needed)

Z.AI is configured via `/etc/.z-ai-config` JSON file. It's already working on the sandbox.

```bash
# Verify it's working:
curl -X POST http://localhost:3055/api/ai/chat \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Say hello"}'
```

### 5.2 Groq (free — 30 RPM, 14,400 RPD)

1. Go to https://console.groq.com/keys
2. Create a free API key
3. Add to `.env`:
   ```bash
   GROQ_API_KEY="gsk_your_key_here"
   ```
4. Restart the server: `pm2 restart marketingos`

### 5.3 Gemini (free — 15 RPM, 1500 RPD, 1M context)

1. Go to https://aistudio.google.com/app/apikey
2. Create a free API key
3. Add to `.env`:
   ```bash
   GEMINI_API_KEY="AIzaSy_your_key_here"
   ```
4. Restart the server

### 5.4 OpenRouter (free — `:free` models only)

1. Go to https://openrouter.ai/keys
2. Create a free API key
3. Add to `.env`:
   ```bash
   OPENROUTER_API_KEY="sk-or-v1_your_key_here"
   ```
4. Restart the server

### 5.5 Local Ollama (free — self-hosted, unlimited)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models (run on the server, not your laptop)
ollama pull llama3.2        # 3B, runs on CPU
ollama pull bge-m3          # embeddings for RAG

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

No `.env` change needed — Ollama at `localhost:11434` is auto-detected.

### 5.6 Verify the chain

```bash
# Check which providers are active
curl -H "Authorization: Bearer <your-jwt-token>" \
  https://marketing.alolabs.net/api/v1/admin/ai-models/chain

# Test a real LLM call
npx tsx scripts/chain-test.ts
```

---

## 6. How to set up SMS delivery (copy-paste — pick ONE provider)

### 6.1 Option A: httpSMS (FREE — uses your Android phone as gateway)

1. Install the httpSMS app on an Android phone: https://httpsms.com
2. Get your API key from the app
3. Add to `.env`:
   ```bash
   HTTPSMS_API_KEY="your_httpsms_key"
   HTTPSMS_FROM_NUMBER="+8801XXXXXXXXX"  # your Android phone number
   ```
4. Restart the server

### 6.2 Option B: sms.domovina.ai (FREE — self-hosted)

```bash
# Deploy via Docker
docker run -d --name sms-domovina -p 8080:8080 \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  domovina/sms-domovina:latest

# Add to .env:
DOMOVINA_SMS_API_URL="http://localhost:8080"
DOMOVINA_SMS_API_KEY="your_domovina_jwt"
```

### 6.3 Option C: Twilio (PAID — pay per message)

1. Sign up at https://www.twilio.com/console
2. Get Account SID, Auth Token, and a phone number
3. Add to `.env`:
   ```bash
   TWILIO_ACCOUNT_SID="AC_your_sid"
   TWILIO_AUTH_TOKEN="your_auth_token"
   TWILIO_FROM_NUMBER="+15551234567"
   ```
4. Restart the server

### 6.4 Test SMS delivery

```bash
# Send a test OTP
curl -X POST http://localhost:3055/api/sms/otp \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"to":"+8801XXXXXXXXX"}'

# Check SMS provider status
curl -H "Authorization: Bearer <your-jwt-token>" \
  http://localhost:3055/api/v1/admin/sms-providers
```

---

## 7. How to set up social publishing (copy-paste)

### 7.1 Deploy Postiz via Docker

```bash
# Create Postiz directory
sudo mkdir -p /opt/postiz && sudo chown $USER:$USER /opt/postiz
cd /opt/postiz

# Download docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/gitroomhq/postiz-app/master/docker-compose.yml

# Edit the config
nano docker-compose.yml
# Set: POSTIZ_API_KEY, JWT_SECRET, etc.

# Start Postiz
docker compose up -d

# Postiz will be available at http://localhost:4000
# Complete the setup wizard, then get your API key from Settings → API
```

### 7.2 Configure MarketingOS to use Postiz

Add to MarketingOS `.env`:

```bash
POSTIZ_BASE_URL="http://localhost:4000"
POSTIZ_API_KEY="your_postiz_api_key"
POSTIZ_WORKSPACE_ID="your_workspace_id"
```

Restart MarketingOS: `pm2 restart marketingos`

### 7.3 Connect social accounts

1. Open MarketingOS dashboard → Sidebar → Social Accounts
2. Click "Connect Facebook" (or Instagram, LinkedIn, X, TikTok, YouTube)
3. Complete OAuth on the provider's official page
4. The account appears in the integrations list

### 7.4 Schedule a post

```bash
curl -X POST http://localhost:3055/api/v1/social/publish \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "<content-id-from-CRUD>",
    "platforms": ["facebook", "instagram"],
    "scheduledAt": "2026-11-06T10:00:00Z"
  }'
```

---

## 8. How to access the Super Admin AI Models page

1. Sign in at `https://marketing.alolabs.net/dashboard`
   - Email: `admin@alolabs.net`
   - Password: (the `ADMIN_SEED_PASSWORD` from `.env`)
2. Sidebar → AI → AI Models
3. You'll see:
   - **Live Chain Preview** — which providers will be tried in what order
   - **Provider Cards** — 11 providers (9 free + 2 paid-disabled)
   - **Test button** per provider — sends a real "Say OK" ping
   - **Add Provider** dialog with 10 Quick-Add presets (Z.AI, Groq, Gemini, OpenRouter, Ollama, OpenCode, Cloudflare, Mistral, HuggingFace, Pollinations)
4. To add a free API key:
   - Click a provider card → Edit
   - Paste your API key (encrypted via AES-256-GCM before storage)
   - Save → the chain immediately starts using it

---

## 9. How to access the public marketing website

The public marketing site is at the root URL:

```
https://marketing.alolabs.net/
```

It has 13 sections: hero, features, AI agents showcase, pricing, FAQ, etc. — all in orange/blue/white ALO Labs brand colors.

The admin dashboard is at:

```
https://marketing.alolabs.net/dashboard
```

---

## 10. How to roll back if something breaks

```bash
# Check PM2 logs
pm2 logs marketingos --lines 100

# Roll back to previous commit
cd /opt/marketingos
git log --oneline -10
git checkout <previous-commit-hash>
npm ci
npx prisma generate
npm run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
pm2 restart marketingos

# Restore database from backup (if needed)
cp /var/backups/marketingos/custom.db.$(date +%Y%m%d).bak db/custom.db
```

---

## 11. How to update MarketingOS (copy-paste)

```bash
cd /opt/marketingos

# Backup current state
cp db/custom.db db/custom.db.$(date +%Y%m%d-%H%M%S).bak

# Pull latest
git pull origin main

# Install any new dependencies
npm ci

# Regenerate Prisma client (if schema changed)
npx prisma generate

# Sync database schema (additive only — no destructive migrations)
npx prisma db push --skip-generate

# Rebuild
npm run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

# Restart
pm2 restart marketingos

# Run tests to verify
npx tsx scripts/verify-login.ts
npx tsx scripts/test-integrations.ts
npx tsx scripts/test-ollama-cloud.ts
npx tsx scripts/test-sms-providers.ts
```

---

## 12. Phase 0 audit — quick reference

| What | Where |
|---|---|
| Phase 0 audit docs | `docs/voice-contact-center/*.md` (6 files) |
| GitHub release | https://github.com/engralaminn-collab/MarketingOS/releases/tag/phase-0-voice-contact-center-audit |
| Repository | https://github.com/engralaminn-collab/MarketingOS |
| Main branch | `main` (commit `c797685`) |
| Status | **STOPPED — waiting for owner approval before Phase 1** |
| Total audit words | ~14,400 |
| Code changes in Phase 0 | **ZERO** (read-only audit) |

---

## 13. Current production status (verified)

| Component | Status |
|---|---|
| Public marketing website (`/`) | LIVE |
| Admin dashboard (`/dashboard`) | LIVE |
| AI chat + content generation | LIVE (Z.AI free tier) |
| AI image generation | LIVE (Z.AI + Pollinations fallback) |
| AI video generation | LIVE (Z.AI) |
| AI voiceover (TTS) | LIVE (Z.AI) |
| AI speech-to-text (ASR) | LIVE (Z.AI) |
| CRM (leads, deals, contacts) | LIVE |
| SEO engine | LIVE |
| Campaigns | LIVE |
| Analytics | LIVE |
| Unified inbox | LIVE |
| AI agent execution (bounded loop) | LIVE |
| Super Admin AI Model Registry | LIVE |
| OAuth+PKCE integration surface | LIVE |
| SMS OTP/send/broadcast | LIVE-able (needs SMS provider env vars) |
| Social publishing | LIVE-able (needs Postiz env vars) |
| Auto-publish cron | LIVE-able (needs CRON_SECRET + scheduler) |
| Tests | 127/127 PASS |
| Production build | PASS (17.8s, 101 static pages) |
| Active AI providers | 9 (all FREE or self-hosted, $0 cost) |
| Paid providers in chain | 0 (ollama-cloud + mistral disabled) |

---

## 14. What to do next

### If you're the owner reviewing Phase 0:

1. Open the 6 audit docs (links in section 1 above)
2. Read `IMPLEMENTATION_ROADMAP.md` first — it has the phase summary
3. Use the copy-paste template in section 2 to approve or reject Phase 1

### If you're deploying MarketingOS for the first time:

1. Follow section 3 (deploy to Ubuntu)
2. Follow section 5 (add free AI keys)
3. Follow section 6 (add SMS provider — optional)
4. Follow section 7 (deploy Postiz — optional)
5. Verify with section 4 (run tests)

### If you want to start Phase 1 implementation:

**Wait for owner approval.** Per the master directive §15: "STOP and wait for explicit owner approval before Phase 1."

Once approved, Phase 1 will:
- Create feature branch `feature/voice-contact-center-phase-1`
- Add MFA, refresh token rotation, voice agent registry, usage metering
- Take 2-3 weeks
- Preserve all existing functionality
- All 127 tests must still pass

---

**Live now:** https://github.com/engralaminn-collab/MarketingOS/releases/tag/phase-0-voice-contact-center-audit
