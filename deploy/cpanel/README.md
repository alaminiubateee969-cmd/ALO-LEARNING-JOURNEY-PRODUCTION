# cPanel Node.js Deployment — learn.aloeducation.com

> **For cPanel “Node.js Application Manager” on host 115.187.18.53**
> Folder: `/home/aloeduca/learn.aloeducation.com` · Domain: `learn.aloeducation.com` · TLS: Let’s Encrypt (valid until 2027-01-12)

Your logs show the app *does* start (`✓ Ready in 0ms` → `NODE_ENV=production node .next/standalone/server.js`) but the **Build/Startup config in cPanel is still using auto-detect defaults**. Fix it once with the values below — then the “added 2 packages in 5s” loop disappears.

---

## 1) Why you see repeated `added 2 packages` + `Ready` logs

| What you saw | Why |
|---|---|
| `added 2 packages in 5s` then `node .next/standalone/server.js` on hosts `1c6b8721…`, `7c052b6b…`, `3ab5161c…` | cPanel runs `npm install` on every restart when **Build command is empty**. It adds the 2 optional `sharp` prebuilds each time, then restarts the container with a new hostname. Normal — but wasteful. Set the explicit Build command below and it runs once. |
| `Local: http://<container>:3000` | Next.js logs the container hostname, **not** your public domain. Your public domain is proxied by cPanel/Apache to whatever `PORT` cPanel injects. If the app binds to `127.0.0.1:3017` (VPS config) the proxy can’t reach it. |
| `PHP Version 8.2` shown next to “Website Builder Node.js” | cPanel always shows a PHP version for the domain, even for Node apps. It does **not** mean the domain is serving PHP. Leave it as is; the Node app handles the domain when “Node.js Running” is shown. |

**No code change is required** — just correct the cPanel form fields below.

---

## 2) Exact cPanel Application Manager settings

Open **cPanel → Application Manager → learn.aloeducation.com → Edit** (or “Manage”).

### Identity and runtime configuration

| Field | Set to |
|---|---|
| **Website name / Domain** | `learn.aloeducation.com` (leave as is — deleting the app leaves domain) |
| **Website Folder** | `/home/aloeduca/learn.aloeducation.com` (your current folder — correct) |
| **Node.js version** | **`22`** (or `22.20.0`). Your `package.json` has `"node": ">=22 <23"`. cPanel likely defaulted to 18/20 → build fails or Prisma mismatch. |
| **Package manager** | `npm` (default — correct. Do **not** switch to yarn/pnpm/bun; `package-lock.json` is canonical) |
| **Build command** | `npm ci && npx prisma generate && npm run build`  — copy-paste exactly. This replaces the empty “detected default” (`npm install`). |
| **Startup command** | `npm run cpanel:start`  — or `node scripts/cpanel-start.mjs` . Do **not** use plain `node .next/standalone/server.js` (it binds to 127.0.0.1 on VPS). The shim binds to `0.0.0.0` and respects cPanel’s injected `PORT`. |
| **Run mode** | **Production** (you already have it correct — keep it) |

> **Build command empty = broken.** cPanel’s auto-detect runs only `npm install`. It skips `prisma generate` and `next build`, so `.next/standalone/server.js` is missing on fresh clones. The explicit command above fixes it.

### Environment variables (cPanel → Environment Variables → Add)

Add these **in the cPanel UI**, not in a `.env` file (cPanel containers ignore `.env` unless you keep it in the app folder). Click “Add Variable” for each:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `mysql://user_learn:<url-encoded-password>@127.0.0.1:3306/db_learn` | Your MySQL. Replace `<…>` with real password. Must be `mysql://` — not `file:` (SQLite is dev-only fallback and will run degraded with no data). |
| `NEXTAUTH_URL` | `https://learn.aloeducation.com` | Must match your domain exactly, with `https://`. |
| `NEXTAUTH_SECRET` | *(generate one locally: `openssl rand -base64 32`)* | Required — admin login fails closed without it. |
| `ADMIN_EMAIL` | `admin@aloeducation.com` (your admin email) | |
| `ADMIN_PASSWORD_HASH` | `scrypt$<salt>$<hash>` (from `node scripts/hash-admin-password.mjs`) | See `.env.example` comment: run `read -rsp 'Admin password: ' p && printf '%s' "$p" \| node scripts/hash-admin-password.mjs && unset p` locally |
| `ADMIN_OTP_PHONE` | `+8801XXXXXXXXX` | E.164 fixed admin phone |
| `HTTPSMS_API_KEY` | *(from httpsms.com dashboard)* | |
| `HTTPSMS_FROM` | `+8801XXXXXXXXX` | |
| `BACKUP_ENCRYPTION_KEY` | *(32+ chars, `openssl rand -base64 32`)* | Required in production (backup snapshots) |
| `HOSTNAME` | `0.0.0.0` | **Critical for cPanel** — do not set `127.0.0.1`. The shim sets this automatically if you omit it, but explicit is clearer. |
| `PORT` | *(leave unset — cPanel injects it)* | If you set it manually, ensure it matches what cPanel shows in “Application URL” details. The shim respects cPanel’s injected PORT. |

Optional (local AI/media):
- `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=qwen2.5:7b`, `ALO_PAID_AI_API_ALLOWED=false` etc — only if that service runs on the same host. Otherwise leave unset; app uses built-in fallbacks.

> **Do not commit secrets** — cPanel env vars are stored encrypted. Verify with: `curl -s https://learn.aloeducation.com/api/health?details=1` (admin session required in production) or `https://learn.aloeducation.com/api/health` (public low-detail).

---

## 3) Deploy steps (do once)

1. **Push this fix** to the server folder `/home/aloeduca/learn.aloeducation.com` (via Git, File Manager, or `git pull` in Terminal). This branch already includes:
   - `scripts/cpanel-start.mjs` (binding fix + diagnostics)
   - `.node-version` / `.nvmrc` (=22)
   - `prisma` binaryTargets now include `rhel-openssl-*` for CloudLinux/cPanel hosts
   - `ecosystem.cpanel.config.js` (if you ever use PM2 on this host)

2. In **cPanel → Application Manager**:
   - Set **Node.js version → 22**, **Build command →** `npm ci && npx prisma generate && npm run build`, **Startup command →** `npm run cpanel:start` → **Save Changes**.

3. Add the **Environment Variables** table above → **Save**.

4. Click **Run Build** (or “Deploy” / “Restart”). Watch **Logs**:
   - Good: `[cpanel] ... storage ready`, `[cpanel] PORT=...`, `[cpanel] HOSTNAME=0.0.0.0`, `Ready in ...ms`
   - Good: no `added 2 packages` on every restart — only on first build.

5. **Verify public site:**
   ```bash
   curl -i https://learn.aloeducation.com/api/health
   # expect: {"status":"ok" or "degraded", "releaseSha":"..."}
   # 503 = DB misconfigured, check DATABASE_URL and MySQL service
   curl -i https://learn.aloeducation.com/
   # expect: 200/301/302
   ```
   If you get `503` or `502`, check:
   - `DATABASE_URL` correct and MySQL `db_learn` reachable on `127.0.0.1:3306`
   - Logs show `[cpanel] WARNING: DATABASE_URL ...` — fix the variable
   - Ensure SSL HTTPS Redirect is **Enabled** (yours already is — keep it)

6. **Do not use `npm install -g npm@12.2.0`** in cPanel — the notice `New major version of npm available! 10.9.9 -> 12.2.0` is informational and safe to ignore on shared hosting. cPanel provides npm 10.9.9; upgrading globally may break the Application Manager.

---

## 4) What changed in this fix

- `scripts/cpanel-start.mjs` — binds to `0.0.0.0` + `PORT` from cPanel, creates `storage/*` dirs, logs clear warnings for missing secrets.
- `package.json` — added `cpanel:build`, `cpanel:start`, `cpanel:health` scripts.
- `prisma/schema.prisma` — added `rhel-openssl-*` binaryTargets so `prisma generate` works on CloudLinux (your host’s OS family).
- `.node-version` / `.nvmrc` — pin Node 22 so cPanel picks the right runtime.
- `next.config.ts` — comment clarifies standalone requirement for cPanel.
- `ecosystem.cpanel.config.js` — alternative PM2 config with correct `0.0.0.0` binding (only needed if you SSH and use PM2 manually; ignore for Application Manager).

---

## 5) Rollback / VPS vs cPanel

- **VPS deploy (Tailscale/PM2/Caddy on 3017)** is *separate* — see `DEPLOYMENT.md`. It uses `PORT=3017`, `HOSTNAME=127.0.0.1`, PM2 `learn-aloeducation`, Caddy `reverse_proxy 127.0.0.1:3017`. Do **not** copy cPanel’s `0.0.0.0` binding to the VPS.
- **cPanel (this host)** uses whatever `PORT` cPanel injects (often 3000, but can be any) and `HOSTNAME=0.0.0.0` behind Apache proxy.

Both share the same codebase; only env vars + startup shim differ.

---

## 6) Troubleshooting

- **502 Bad Gateway / 503** — App not listening on the PORT cPanel expects. Fix Startup command to `npm run cpanel:start` and HOSTNAME to `0.0.0.0`.
- **Prisma error “Please run prisma generate”** — Build command missing `npx prisma generate`. Set the full build command and Rebuild.
- **Login fails closed / redirect loop** — Set `NEXTAUTH_URL=https://learn.aloeducation.com` and `NEXTAUTH_SECRET` (32+ chars).
- **Empty page but `Ready` in logs** — Check `DATABASE_URL` — without MySQL the app runs but `/api/health` returns 503 and pages may be empty. The shim logs `DATABASE_URL scheme=...`.
- **Storage not writable** — The shim auto-creates `./storage/*` on start. If cPanel runs as different user, `chmod 755 storage` via File Manager → Permissions.

Need deeper logs? In cPanel → Application Manager → Logs, look for `[cpanel]` prefix lines.
