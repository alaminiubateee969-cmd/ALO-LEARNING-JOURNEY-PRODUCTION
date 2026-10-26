# ⚡ Quick Fix — Your cPanel Node.js App is Running but Misconfigured

**Your host:** `learn.aloeducation.com` → `/home/aloeduca/learn.aloeducation.com` → `115.187.18.53` → TLS valid until 2027-01-12 → Node.js Running ✅

**Your logs are healthy** — `✓ Ready in 0ms` means Next.js did start. The repeated deploys (hostnames `1c6b872...`, `7c052b6...`, `3ab5161...`) are cPanel re-running `npm install` because **Build command is empty**.

## Fix in 2 minutes

In **cPanel → Application Manager → learn.aloeducation.com**:

1. **Node.js version:** change to **`22`** (you have `>=22 <23` in `package.json`)
2. **Build command:** paste `npm ci && npx prisma generate && npm run build`
3. **Startup command:** paste `npm run cpanel:start`
4. **Save Changes**
5. **Environment Variables → Add:**
   - `DATABASE_URL` = `mysql://user_learn:PASSWORD@127.0.0.1:3306/db_learn`
   - `NEXTAUTH_URL` = `https://learn.aloeducation.com`
   - `NEXTAUTH_SECRET` = `openssl rand -base64 32` (generate locally)
   - `HOSTNAME` = `0.0.0.0`
   - *(plus ADMIN_EMAIL / ADMIN_PASSWORD_HASH / BACKUP_ENCRYPTION_KEY per deploy/cpanel/README.md)*
6. Click **Restart** or **Run Build**, then **Logs** should show `[cpanel] HOSTNAME=0.0.0.0` and no more `added 2 packages` loops.

Verify: `curl https://learn.aloeducation.com/api/health` → `{"status":"ok"}`

Full guide: `deploy/cpanel/README.md`
