# 03 — Staged deployment & rollback runbook

**Status: NOT EXECUTED.** Nothing here has been run against your VPS. This is the
plan to execute once (a) the canonical source is unambiguous, (b) the build
blocker F2 is approved and merged, and (c) the audit confirms the live document
roots and service wiring.

It replaces the current in-place `git pull && build && restart` approach
(finding F10), which has no atomic swap and — with only one commit in history —
**no possible rollback**.

---

## 0. Preconditions — do not skip

| # | Precondition | Why | How to confirm |
|---|---|---|---|
| P1 | Canonical repo + branch + commit identified | You cannot roll back to a source you cannot name | §A.3 of `02-VERIFIED-FINDINGS.md` |
| P2 | Deploy path resolved: `/root/ALO-LEARNING-JOURNEY` vs `/home/aloedu/learn-app` | CI overwrites `/home/aloedu/learn-app` on every push to `main` | `01-ACCESS-BLOCKER.md` §C question 4 |
| P3 | F2 type error fixed and building | Build currently produces no `.next/standalone` → PM2 cannot start | `tsc --noEmit` exits 0 |
| P4 | VPS can reach `binaries.prisma.sh` and `fonts.googleapis.com` | Otherwise `prisma generate` and `next build` both fail (F3) | the two `curl` checks in §C.3 |
| P5 | **Verified restorable DB backup taken immediately before deploy** | `prisma db push` can drop columns; no migrations exist to undo it (F8) | §2 below |
| P6 | Application backup / snapshot of the current release | Only real rollback path, since Git history has 1 commit (F10) | §2 below |
| P7 | Current live docroot + service state recorded | Needed to prove "before" vs "after" | audit §5–§7 |
| P8 | Auth decision made for the 39 open routes (F5) | `SECURITY.md` says it must not go live without auth | your call |
| P9 | `.env` on the VPS has correct perms and required vars | `DATABASE_URL`, `PORT`, `NODE_ENV` are the only ones read | audit §8 |

**Stop conditions:** if P1–P4 are not all satisfied, do not deploy. If P5 or P6
cannot be produced, do not deploy — an unbacked deploy with `db push` is
unrecoverable.

---

## 1. Target layout (atomic, symlink-swapped)

```
/home/aloedu/                      # or whichever user P2 confirms
├── releases/
│   ├── 20260914-153000-e95b39b/   # immutable, fully built
│   └── 20260915-091500-<sha>/
├── shared/
│   ├── .env                       # 0600, app user, NEVER in Git, NEVER copied per release
│   ├── db/custom.db               # the live SQLite file — persists across releases
│   └── storage/                   # uploads/videos/backups — persists across releases
└── current -> releases/20260915-091500-<sha>    # the symlink PM2 & Caddy follow
```

Why this shape, given what the code actually does:

- **`shared/.env`** — secrets stay outside every release and outside Git. Each
  release symlinks to it.
- **`shared/db/custom.db`** — F9 showed backups read
  `<cwd>/db/custom.db` while Prisma reads `DATABASE_URL`. Putting the DB in
  `shared` and pointing `DATABASE_URL` at `file:/home/aloedu/shared/db/custom.db`
  (absolute, **not** relative) makes both agree and stops the database moving
  when the release directory changes.
- **`shared/storage`** — §B.3 proved all storage paths are
  `path.join(process.cwd(), "storage", …)`. Symlink `<release>/storage ->
  ../shared/storage` so uploads/videos/backups survive a release swap and PM2's
  cwd change.
- **`current` symlink** — swap is one atomic `ln -sfn`. Rollback is the same
  command pointed at the previous release. No rebuild needed.

**PM2 must be started with an explicit cwd** matching `current`, otherwise the
`process.cwd()`-relative paths above resolve wrongly:

```js
// ecosystem.config.js — proposed change (approval required)
module.exports = {
  apps: [{
    name: 'alo-learning-journey',
    cwd: '/home/aloedu/current',            // ← added: pins process.cwd()
    script: '.next/standalone/server.js',
    env: { NODE_ENV: 'production', PORT: 3017 },
    instances: 1, autorestart: true, max_memory_restart: '512M',
  }],
};
```

---

## 2. Backup gate (blocking — must succeed before any deploy)

```bash
set -euo pipefail
TS=$(date -u +%Y%m%d-%H%M%S)
BK=/root/alo-backups/$TS            # or an off-server target; see note
mkdir -p "$BK"; chmod 700 "$BK"

# 2.1 Database — SQLite must be copied CONSISTENTLY. A plain cp of a live
#     SQLite file can capture a half-written page. Use the sqlite3 backup API
#     (or .backup), NOT cp, while the app is running.
DB=/home/aloedu/shared/db/custom.db     # confirm from DATABASE_URL first
sqlite3 "$DB" ".backup '$BK/custom.db'"
sqlite3 "$BK/custom.db" "PRAGMA integrity_check;" | tee "$BK/db-integrity.txt"
#   expected: "ok"   — if not "ok", STOP. Do not deploy on a corrupt source DB.

# 2.2 Schema fingerprint, so you can prove what db push changed
sha256sum "$DB" > "$BK/db.sha256"
sqlite3 "$DB" ".schema" > "$BK/schema-before.sql"
sqlite3 "$DB" "select name from sqlite_master where type='table' order by 1;" \
  > "$BK/tables-before.txt"

# 2.3 Application release currently live
readlink -f /home/aloedu/current > "$BK/current-release.txt" 2>/dev/null || true
tar -czf "$BK/app-current.tar.gz" -C /home/aloedu \
    --exclude=node_modules --exclude=.next releases current 2>/dev/null || true

# 2.4 Secrets (root-only; NEVER into Git, NEVER into the audit report)
install -m 600 /dev/null "$BK/env.sha256"
sha256sum /home/aloedu/shared/.env > "$BK/env.sha256"   # fingerprint only, not a copy

# 2.5 Prove the backup is RESTORABLE, not merely present
sqlite3 "$BK/custom.db" "select count(*) from Company;"   # must return a number
du -sh "$BK"; ls -la "$BK"
echo "BACKUP GATE PASSED: $BK"
```

> **Off-server copy.** A backup on the same disk does not survive disk loss, and
> your section 4 asks for a *recoverable* backup. If `rclone`/`restic`/`borg` is
> available, push `$BK` offsite and verify by listing the remote. The audit
> script reports which of those tools exist.

> **`integrity_check` and the `select count(*)` are the two lines that matter.**
> A backup you have not restored is an assumption. Note that the committed
> artefact from F4 is **not** a substitute: it is stale (15 of 27 tables) and
> self-expired (retention 14 days from 2026-08-09).

---

## 3. Build the release in staging (never in the live directory)

```bash
set -euo pipefail
SHA=<verified_commit_sha>
REL=/home/aloedu/releases/$(date -u +%Y%m%d-%H%M%S)-${SHA:0:7}
git clone /path/to/staging-clone "$REL"        # or: git clone <repo> "$REL"
cd "$REL"
git checkout "$SHA"
git rev-parse HEAD                              # must equal $SHA — record it

# Link shared state BEFORE building, so cwd-relative paths resolve
ln -sfn /home/aloedu/shared/.env     .env
ln -sfn /home/aloedu/shared/storage  storage
mkdir -p db && ln -sfn /home/aloedu/shared/db/custom.db db/custom.db

bun install --frozen-lockfile                   # honours bun.lock; do NOT use npm
bunx prisma generate                            # needs binaries.prisma.sh (P4)
bunx prisma db push --skip-generate             # ⚠ see §3.1 — run ONLY with approval
bun run build                                   # needs fonts.googleapis.com (P4)

# HARD GATES — the build must produce a startable artefact
test -f .next/standalone/server.js || { echo "FATAL: no standalone server.js — DO NOT SWAP"; exit 1; }
npx tsc --noEmit               || { echo "FATAL: type check failed — DO NOT SWAP"; exit 1; }

# Smoke-test the candidate on a spare port WITHOUT touching production
PORT=3199 NODE_ENV=production bun .next/standalone/server.js &
CAND=$!; sleep 6
curl -sf http://127.0.0.1:3199/api/health >/dev/null || { kill $CAND; echo "FATAL: candidate unhealthy"; exit 1; }
curl -sf -o /dev/null -w 'candidate / -> %{http_code}\n' http://127.0.0.1:3199/
kill $CAND
echo "RELEASE CANDIDATE READY: $REL"
```

### 3.1 ⚠ The `prisma db push` problem

The command above is shown in sequence because that is what `deploy.yml` does —
but **it must not run unattended**, and per your instruction I have run no
migration and will not.

- There is **no `prisma/migrations/` directory**, so `db push` diffs the schema
  against the live database and applies changes directly, with no history and no
  undo (F8/§C.6).
- `package.json`'s own `db:push` adds **`--accept-data-loss`**.
- `deploy.yml` runs it on **every push to `main`**, before the build.

**Safe sequence instead:**

```bash
# 1. See what WOULD change, without applying anything:
bunx prisma migrate diff \
  --from-url "file:/home/aloedu/shared/db/custom.db" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
# 2. Read that SQL. If it contains DROP TABLE / DROP COLUMN / ALTER requiring
#    data loss -> STOP and get explicit approval. Take a fresh §2 backup first.
# 3. Only then apply, with the backup gate already passed:
bunx prisma db push
# 4. Immediately re-fingerprint:
sqlite3 /home/aloedu/shared/db/custom.db ".schema" > /root/alo-backups/$TS/schema-after.sql
diff /root/alo-backups/$TS/schema-before.sql /root/alo-backups/$TS/schema-after.sql
```

**Longer term:** adopt real migrations (`prisma migrate dev` → commit the
generated `prisma/migrations/*` → deploy with `prisma migrate deploy`). That is
the only way to get schema rollback. It is a change to the project, so it needs
your approval.

---

## 4. Swap, and keep the rollback handle

```bash
set -euo pipefail
PREV=$(readlink -f /home/aloedu/current)          # ← THE ROLLBACK HANDLE
REL=<the release dir from §3>
echo "$PREV" | sudo tee -a /home/aloedu/releases/.rollback-history

# Atomic swap
ln -sfn "$REL" /home/aloedu/current

# Restart against the new target
pm2 reload ecosystem.config.js --update-env || pm2 restart alo-learning-journey --update-env
pm2 save
sleep 5
pm2 ls
```

**Rollback (fast — no rebuild, seconds):**

```bash
pm2 stop alo-learning-journey
ln -sfn <PREV> /home/aloedu/current
pm2 restart alo-learning-journey --update-env
```

**Rollback (full — if `db push` changed the schema):** the symlink is not enough,
because the database is shared and may already be altered.

```bash
pm2 stop alo-learning-journey
ln -sfn <PREV> /home/aloedu/current
# restore the DB from the §2 gate — verified with integrity_check first
sqlite3 /root/alo-backups/<TS>/custom.db "PRAGMA integrity_check;"   # must print ok
mv /home/aloedu/shared/db/custom.db /home/aloedu/shared/db/custom.db.bad-$(date -u +%s)
cp /root/alo-backups/<TS>/custom.db /home/aloedu/shared/db/custom.db
chown <appuser>:<appgroup> /home/aloedu/shared/db/custom.db
sqlite3 /home/aloedu/shared/db/custom.db "PRAGMA integrity_check;"   # must print ok
pm2 restart alo-learning-journey --update-env
```

Note the corrupted file is **moved aside, never deleted** — you may need it for
forensics. Keep the last 3–5 releases on disk; delete older ones only via a
deliberate, separate step.

---

## 5. Post-deploy verification — the exact checks to run

Record actual output for every line. **A green CI run is not evidence** (F1: the
health endpoint always returns 200 and `"status":"PARTIAL"`, and the CI
`|| echo` swallows failures).

```bash
# 5.1 Process & port
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);a.forEach(p=>console.log(p.name,p.pm2_env.status,"restarts="+p.pm2_env.restart_time,"cwd="+p.pm2_env.pm_cwd,"port="+(p.pm2_env.env?.PORT||"?")))}'
ss -tlnp | grep -E ':3017|:80|:443'

# 5.2 App responds locally
curl -sS -o /dev/null -w 'local /            -> %{http_code}\n' http://127.0.0.1:3017/
curl -sS http://127.0.0.1:3017/api/health | head -c 400; echo

# 5.3 DATABASE CONNECTIVITY — real proof, since /api/health cannot give it (F1)
sqlite3 /home/aloedu/shared/db/custom.db "PRAGMA integrity_check;"
sqlite3 /home/aloedu/shared/db/custom.db "select count(*) from Company;"
sqlite3 /home/aloedu/shared/db/custom.db "select name from sqlite_master where type='table' order by 1;" | wc -l
#   ^ compare against the 27 models in prisma/schema.prisma. Fewer tables than
#     models = schema drift (this is exactly the 15-vs-27 gap seen in F4).

# 5.4 Essential API routes — expect 200/201/405, NOT 500
for r in /api/health /api/agents /api/dashboard /api/companies /api/ideas \
         /api/approvals /api/analytics /api/notifications /api/settings \
         /api/rag/search /api/activity /api/audit /api/learning /api/growth; do
  printf '%-22s %s\n' "$r" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3017$r)"
done
#   A 500 on any route almost always means the Prisma client or DB path is wrong
#   (F3/F9). Capture the body of any non-2xx: curl -sS http://127.0.0.1:3017$r

# 5.5 Reverse proxy & public site
curl -sSI --max-time 12 https://learn.aloeducation.com/ | head -12
curl -sS  -o /dev/null -w 'public / -> %{http_code}  tls=%{ssl_verify_result}\n' https://learn.aloeducation.com/
curl -sS  -o /dev/null -w 'proxy -> upstream %{http_code}\n' https://learn.aloeducation.com/api/health

# 5.6 Which app answers which domain — resolves audit item 7 by evidence
for h in aloeducation.com www.aloeducation.com learn.aloeducation.com crm.aloeducation.com; do
  printf '%-28s dns=%s http=%s https=%s\n' "$h" "$(getent hosts $h | awk '{print $1; exit}')" \
    "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://$h/ 2>/dev/null)" \
    "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -k https://$h/ 2>/dev/null)"
done

# 5.7 LOGIN / CRM — cannot be scripted blindly. Verify by hand and record:
#   - CRM URL, the login page renders, valid credentials authenticate
#   - an invalid login is rejected
#   - which directory the CRM's vhost DocumentRoot actually points at
#   ⚠ This app has NO authentication at all (F5, and SECURITY.md says
#     NOT_IMPLEMENTED). If the "login" you test is served by this app, that is a
#     serious finding — report it. If it is served by a different application
#     (a PHP/Laravel CRM under public_html), then THIS deployment did not change
#     it, and the CRM must be re-tested only for collateral damage.
#   The audit script §3 fingerprints each directory (composer.json => PHP,
#   package.json => Node) so the CRM's real stack is identified, not assumed.

# 5.8 SSL / cert sanity — read-only, changes nothing
echo | openssl s_client -servername learn.aloeducation.com -connect learn.aloeducation.com:443 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates

# 5.9 Storage writability (all paths are cwd-relative — §B.3)
sudo -u <appuser> test -w /home/aloedu/current/storage/videos && echo "storage writable" || echo "STORAGE NOT WRITABLE"
ls -la /home/aloedu/current/storage /home/aloedu/current/db   # confirm the symlinks resolved

# 5.10 Errors since the swap
pm2 logs alo-learning-journey --lines 60 --nostream
journalctl -u caddy -n 40 --no-pager 2>/dev/null || tail -40 /var/log/caddy/*.log 2>/dev/null
```

### Pass/fail bar

| Check | Pass condition |
|---|---|
| 5.1 | PM2 `online`, restart count stable (not looping), cwd = `/home/aloedu/current`, port 3017 listening |
| 5.2 | HTTP 200 on `/`; `/api/health` returns JSON |
| 5.3 | `integrity_check` = `ok`; counts return; table count reconciled against 27 models |
| 5.4 | No `500` on any listed route |
| 5.5 | 200 over HTTPS, valid cert, proxy reaches upstream |
| 5.6 | Each domain resolves to *this* server and answers |
| 5.7 | CRM login works and its docroot is recorded |
| 5.9 | storage writable, symlinks resolved |
| 5.10 | No Prisma/`ENOENT`/`EACCES` errors after the swap |

**Any failure → roll back immediately with §4.** Do not debug in production.

---

## 6. Things this runbook deliberately does NOT do

- Does not stop or remove any service that looks idle — idle is not evidence of
  obsolete, and you explicitly forbade it.
- Does not change DNS, SSL certificates, firewall rules, or reverse-proxy config.
  The Caddy swap is limited to what `current` points at, and only if Caddy is
  confirmed as the live proxy by audit §6.
- Does not run `prisma db push`, `db:push --accept-data-loss`, or `db:reset`
  without the §3.1 diff being read and approved.
- Does not `git reset --hard`, force-push, discard local changes, or overwrite a
  working tree.
- Does not delete the existing `/root/ALO-LEARNING-JOURNEY` or
  `/root/alo-github-main-new`. Both are preserved; staging is a **separate**
  directory, as you required.
- Does not add `.env`, `.env.save`, credentials, private keys, DB dumps, or
  secret backups to Git. §1 keeps secrets in `shared/`, outside every release.
- Does not expose remote URLs containing credentials (the audit script scrubs
  `user:token@` from every URL and DSN it prints).
