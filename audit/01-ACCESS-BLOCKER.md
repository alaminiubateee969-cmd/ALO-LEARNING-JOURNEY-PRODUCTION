# 01 — ACCESS BLOCKER: this session is not on your VPS

Your instructions were explicit: *"Inspect the actual server and repository state
before making changes. Do not guess."* I followed that. The inspection showed
that **the actual server is not reachable from this session**, so the VPS-side
audit items (1–10) cannot be reported as fact. This document is the evidence,
and the exact way to resolve it.

---

## Evidence: where this session is actually running

| Check | Command | Observed result |
|---|---|---|
| Hostname | `hostname` | `e2b.local` — an ephemeral build sandbox, not a VPS |
| OS | `cat /etc/os-release` | `Debian GNU/Linux 12 (bookworm)` |
| Identity | `id` | `uid=1001(user) gid=1001(user) groups=1001(user),27(sudo),100(users)` — not `root`, not `aloeduca`, not `aloedu` |
| Disk | `df -h` | `/dev/root 21G, 846M used, 20G avail, 5%` — a 21 GB sandbox disk, not a production volume holding 3.3 GB + 3.1 GB + 3×1.2 GB archives |
| Working dir | `pwd` | `/home/user/ALO-LEARNING-JOURNEY-PRODUCTION` (a Git checkout) |

### Every path you named is absent here

```
ABSENT: /root/ALO-LEARNING-JOURNEY
ABSENT: /root/alo-github-main-new
ABSENT: /root/alo-live
ABSENT: /root/alo-live-new
ABSENT: /root/alo-github-main
ABSENT: /var/www/alo-education
ABSENT: /var/www/alo-education_vps
ABSENT: /home/aloeduca                 (directory /home/aloeduca does not exist)
ABSENT: /home/aloeduca/alo-education
ABSENT: /home/aloeduca/public_html
```

`/var/www` **does not exist at all** on this host. `/home` contains only `node`
and `user`. `/opt` contains only `yarn-v1.22.22`.

### No production stack is installed here

```
systemctl   /usr/bin/systemctl     (present, but no ALO units)
pm2         NOT INSTALLED
docker      NOT INSTALLED
nginx       NOT INSTALLED
apache2     NOT INSTALLED
httpd       NOT INSTALLED
caddy       NOT INSTALLED
litespeed   NOT INSTALLED
lsphp       NOT INSTALLED
mysql       NOT INSTALLED
psql        NOT INSTALLED
sqlite3     NOT INSTALLED
bun         NOT INSTALLED
node        /usr/local/bin/node    v22.22.3
npm         /usr/local/bin/npm     10.9.8
```

### No route to your server

Listening sockets on this host are only `0.0.0.0:111` (rpcbind), `*:49983`, and
`*:22` (the sandbox's own sshd). There is **no `~/.ssh` directory**, no SSH
private key, no `known_hosts`, no stored VPS address, and no `sshpass`/`rsync`.
Outbound HTTPS works for `github.com`, `api.github.com` and `registry.npmjs.org`,
but is blocked for `fonts.googleapis.com` and `binaries.prisma.sh`
(`SSL_ERROR_SYSCALL`) — a sandbox egress allowlist, not your firewall.

**Conclusion:** I have no means to reach the ALO VPS. Reporting host metrics,
vhost document roots, PM2 state, or database migration status for your server
would be fabrication. I have not done it, and I will not.

---

## What this means for your requested audit (section 2, items 1–10)

| # | Requested | Status | Why |
|---|---|---|---|
| 1 | VPS hostname, OS, disk usage/free | **BLOCKED** | Not on the VPS. Sandbox values above are *not* your server's |
| 2 | Git metadata/remotes/branches/commits/status for both dirs | **BLOCKED** for both VPS dirs. **DONE** for the GitHub remote (see `02-VERIFIED-FINDINGS.md` §A) | Dirs absent here; GitHub is reachable |
| 3 | Whether either dir is missing `.git` | **BLOCKED** | Cannot be determined remotely. The audit script answers this definitively in one run |
| 4 | Manifests / Prisma / Docker / deploy config | **DONE** from the repository — the authoritative copy | Repo inspected directly |
| 5 | Running processes, systemd, PM2, Docker, ports, proxy config | **BLOCKED** | Not on the VPS |
| 6 | Apache/Nginx/LiteSpeed vhost docroots and upstreams | **BLOCKED** | Not on the VPS. Repo *declares* Caddy → `localhost:3017` for `learn.aloeducation.com`; that is a declaration, not proof of live config |
| 7 | Which app serves the public site and CRM | **BLOCKED** | Requires vhost config + HTTP probes from the server. Cannot be inferred — and you correctly warned against inferring it from one unused port |
| 8 | DB type, target, migration status, backups | **PARTIAL** | Type + schema + migration *strategy* verified from repo (SQLite, no migrations dir). Live target, actual migration state and backup existence are **BLOCKED** |
| 9 | Largest dirs/files under `/root`, `/home`, `/var/www`, `/opt` | **BLOCKED** | Not on the VPS |
| 10 | Duplicate archives by checksum | **BLOCKED** | Archives absent here |

Item 4 and the schema half of item 8 are genuinely complete, because the Git
repository **is** the authoritative source for those, and I have it.

Also note: the report location you specified, `/root/ALO-LEARNING-JOURNEY/audit/`,
does not exist on this host. I created the equivalent `audit/` directory inside
the repository checkout, so these files travel to the VPS with the next deploy or
`git pull`. Once on the server they land at exactly the path you asked for, if
that directory is the deployed repo root.

---

## Three ways to unblock — pick one

### Option A — You run the two scripts and paste the output  *(fastest, safest)*

No credentials leave your hands, nothing is exposed to a third party.

```bash
sudo bash /root/ALO-LEARNING-JOURNEY/audit/vps-readonly-audit.sh --checksums
```

It writes `/root/ALO-LEARNING-JOURNEY/audit/vps-audit-<timestamp>.txt`.
Paste that file (or attach it). It is secret-scrubbed by design: `.env` files are
never printed (only variable *names*), Git remote URLs have any
`user:token@` stripped, and DB connection strings are reduced to
scheme/host/dbname. Then I will produce the real items 1–10, the canonical-source
determination, and a costed cleanup proposal with exact reclaim figures.

The `--checksums` pass hashes the multi-GB archives. On a busy production box,
run it as `sudo ionice -c3 nice -n19 bash …` to avoid I/O starvation. If you
would rather not spend ~10 GB of reads now, drop `--checksums` — but then
duplication stays *unproven* and the cleanup script will (correctly) refuse to
move any archive.

### Option B — Give this session a route to the VPS

If Arena's environment can be given outbound SSH to your server, I need:

- the VPS hostname or IP,
- the SSH port if not 22,
- the SSH username,
- an **authorized key** added to that account (generate one on the VPS and add
  the public half; do **not** paste a private key or a password into chat).

I will not ask for a password, an existing private key, a GitHub token, or a
2FA code. If the sandbox egress allowlist blocks port 22 outbound, this option
will not work and Option A is the way.

### Option C — Targeted answers to 9 specific questions

If you prefer not to run scripts, these nine outputs resolve nearly everything.
All are read-only; none print secrets.

```bash
# 1. Host + disk
hostname -f; cat /etc/os-release | head -3; df -hT -x tmpfs -x devtmpfs; df -i /

# 2. Git state of BOTH protected dirs (scrub any token from the remote line before pasting)
for d in /root/ALO-LEARNING-JOURNEY /root/alo-github-main-new /home/aloedu/learn-app; do
  echo "=== $d"; [ -d "$d/.git" ] || { echo "NO .git"; continue; }
  git -C "$d" remote -v; git -C "$d" rev-parse --abbrev-ref HEAD; git -C "$d" rev-parse HEAD
  git -C "$d" log -1 --format='%cI %s'; git -C "$d" status --porcelain=v1 -b | head -40
done

# 3. What is actually serving traffic
ss -tlnp | head -40
pm2 ls 2>/dev/null; pm2 jlist 2>/dev/null | head -5
systemctl list-units --type=service --state=running --no-pager | grep -iE 'nginx|apache|caddy|lsws|mysql|maria|pm2|node'
apache2ctl -S 2>/dev/null; nginx -T 2>/dev/null | grep -E 'server_name|root|proxy_pass|listen'
ls -la /etc/caddy/Caddyfile /root/Caddyfile 2>/dev/null && cat /etc/caddy/Caddyfile

# 4. Which directories are wired into config (this decides what is 'live')
grep -rniE 'alo|learn-app|ALO-LEARNING' /etc/apache2 /etc/nginx /etc/caddy \
  /usr/local/lsws/conf /etc/systemd/system /etc/cron* 2>/dev/null | head -30

# 5. Env var NAMES only (never values)
for f in /root/ALO-LEARNING-JOURNEY/.env /home/aloedu/learn-app/.env /root/alo-github-main-new/.env; do
  [ -f "$f" ] && { echo "== $f  $(stat -c '%A %U:%G' "$f")";
    grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$f" | tr -d '=' | sort -u; }
done

# 6. Database target shape, password stripped
grep -h '^DATABASE_URL=' /root/ALO-LEARNING-JOURNEY/.env /home/aloedu/learn-app/.env 2>/dev/null \
  | sed -E 's#(//)[^/@]*@#\1***@#; s#:[^:@/]*@#:***@#'
find /root /home /var/www -maxdepth 6 \( -name '*.db' -o -name '*.sqlite*' \) \
  -not -path '*/node_modules/*' -printf '%10s %TY-%Tm-%Td %p\n' 2>/dev/null | sort -rn | head

# 7. Backups that actually exist
find /root /home /var /opt -maxdepth 5 \( -iname '*.sql*' -o -iname '*.bak' -o -iname '*backup*' \) \
  -not -path '*/node_modules/*' -printf '%10s %TY-%Tm-%Td %p\n' 2>/dev/null | sort -k2 -r | head -30

# 8. Sizes of every cleanup candidate, re-measured today
for p in /root/alo-live /root/alo-live-new /root/alo-github-main /var/www/alo-education \
         /var/www/alo-education_vps /home/aloeduca/alo-education /home/aloeduca/public_html \
         "/root/ALO-FULL-SOURCE 2.zip" "/home/aloeduca/ALO-FULL-SOURCE 2.zip" \
         "/home/aloeduca/ssl/.well-known.zip"; do
  [ -e "$p" ] && printf '%-45s %8s  mtime=%s  atime=%s\n' "$p" "$(du -xsh "$p" | cut -f1)" \
    "$(stat -c %y "$p" | cut -d. -f1)" "$(stat -c %x "$p" | cut -d. -f1)" || echo "$p  ABSENT"
done

# 9. Duplicate archives + proof of byte-identity (slow part; run under ionice)
find /root /home /var /opt -xdev -type f \( -iname '*.zip' -o -iname '*.tar.gz' \) \
  -not -path '*/node_modules/*' -printf '%10s %TY-%Tm-%Td %p\n' | sort -rn | head -30
```

> `atime` in #8 matters: a live document root is read constantly, an abandoned
> copy is not. If your mount uses `relatime`/`noatime`, say so and I will weight
> it accordingly rather than over-reading that signal.

---

## What I will *not* do until one of the above is satisfied

- Name a canonical repository, branch, or deployment source.
- Deploy, `git pull`, `git reset`, or switch branches in any VPS directory.
- Move, quarantine, or delete any file on the VPS.
- Report disk-reclaim figures for your server.
- Claim the site, CRM, login, or any API route is healthy.

Two of those are blocked by a further, independent problem anyway: **the
production commit does not build** (finding F2). Even with full VPS access, this
release could not be deployed as-is. Fixing that is prerequisite work, and it is
already done and verified on my branch pending your approval.
