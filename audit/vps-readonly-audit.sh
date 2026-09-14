#!/usr/bin/env bash
# =============================================================================
# ALO Education VPS — READ-ONLY AUDIT
# -----------------------------------------------------------------------------
# Purpose : Collect the evidence needed to (a) identify the canonical GitHub
#           source, (b) confirm what is actually serving production, and
#           (c) classify obsolete files BEFORE any cleanup.
#
# SAFETY  : This script performs NO writes, NO deletes, NO service restarts,
#           NO git fetch/pull/checkout, NO package installs, NO migrations.
#           The only thing it creates is its own report directory.
#
# SECRETS : .env files are NEVER printed. Only variable NAMES are listed.
#           Git remote URLs are scrubbed of any embedded user:token@.
#           DB connection strings are reported as scheme/host/dbname only.
#
# Usage   : sudo bash vps-readonly-audit.sh            # standard audit
#           sudo bash vps-readonly-audit.sh --checksums  # + SHA-256 of big archives
#                                                        #   (slow: multi-GB reads)
#
# NOTE on --checksums: hashing 3.3 GB + 3.1 GB + 3 x 1.2 GB adds ~10 GB of disk
# reads. On a live production box prefer running it inside `ionice -c3 nice -n19`.
# =============================================================================
set -uo pipefail   # deliberately NOT -e : we want every section to run even if
                    # a command is missing on this particular server.

DO_CHECKSUMS=0
[[ "${1:-}" == "--checksums" ]] && DO_CHECKSUMS=1

TS="$(date -u +%Y%m%d-%H%M%SZ)"
OUT="${ALO_AUDIT_OUT:-/root/ALO-LEARNING-JOURNEY/audit}"
# Fall back to a writable location if the target dir does not exist yet.
mkdir -p "$OUT" 2>/dev/null || OUT="/tmp/alo-audit-$TS"
mkdir -p "$OUT" 2>/dev/null || OUT="/tmp"
REPORT="$OUT/vps-audit-$TS.txt"

# --- directories named by the operator ---------------------------------------
PROTECTED_DIRS=(
  "/root/ALO-LEARNING-JOURNEY"      # intended NEW project dir
  "/root/alo-github-main-new"       # stated ORIGINAL source dir
)
CANDIDATE_PATHS=(
  "/root/alo-live"
  "/root/alo-live-new"
  "/root/alo-github-main"
  "/var/www/alo-education"
  "/var/www/alo-education_vps"
  "/home/aloeduca/alo-education"
  "/home/aloeduca/public_html"
  "/home/aloedu/learn-app"          # declared by .github/workflows/deploy.yml
  "/root/ALO-FULL-SOURCE 2.zip"
  "/home/aloeduca/ALO-FULL-SOURCE 2.zip"
  "/home/aloeduca/ssl/.well-known.zip"
)
SCAN_ROOTS=(/root /home /var/www /opt /srv /usr/local)

# --- output helpers ----------------------------------------------------------
exec > >(tee -a "$REPORT") 2>&1
hr()  { printf '\n%s\n' "==============================================================================="; }
sec() { hr; printf '### %s\n' "$1"; hr; }
have(){ command -v "$1" >/dev/null 2>&1; }
run() { printf '\n$ %s\n' "$*"; eval "$@" 2>&1 | head -n 120; }
# scrub credentials out of any URL / DSN before it reaches the report
scrub() {
  sed -E \
    -e 's#(//)[^/@[:space:]]*@#\1***CREDENTIALS-REDACTED***@#g' \
    -e 's#((?:password|passwd|pwd)=[^&[:space:]]*)#***REDACTED***#gi' \
    -e 's#(ghp_[A-Za-z0-9]{6})[A-Za-z0-9]+#\1***REDACTED***#g' \
    -e 's#(github_pat_[A-Za-z0-9_]{6})[A-Za-z0-9_]+#\1***REDACTED***#g' \
    -e 's#(AKIA[0-9A-Z]{4})[0-9A-Z]+#\1***REDACTED***#g' \
    -e 's#(xox[baprs]-[A-Za-z0-9-]{4})[A-Za-z0-9-]+#\1***REDACTED***#g'
}

echo "ALO EDUCATION VPS — READ-ONLY AUDIT"
echo "Generated (UTC) : $TS"
echo "Report file     : $REPORT"
echo "Mode            : READ-ONLY  (no writes outside this report, no service changes)"
echo "Checksums       : $([[ $DO_CHECKSUMS -eq 1 ]] && echo ENABLED || echo 'disabled (pass --checksums)')"

# =============================================================================
sec "1. HOST / OS / DISK"
# =============================================================================
run "hostname -f"; run "hostnamectl 2>/dev/null | head -20"
run "uname -a"
run "cat /etc/os-release | head -8"
run "uptime"
echo; echo "--- Block device usage ---"; df -hT -x tmpfs -x devtmpfs 2>/dev/null
echo; echo "--- Inode usage (a full inode table mimics 'no space') ---"; df -i -x tmpfs -x devtmpfs 2>/dev/null
echo; echo "--- Mounts of interest ---"; mount | grep -E ' /(root|home|var|opt) ' 2>/dev/null
echo; echo "--- Same-filesystem check for quarantine planning ---"
for d in /root /home /var/www /opt /tmp; do
  [[ -d $d ]] && printf '%-12s -> device %s\n' "$d" "$(stat -f -c '%i' "$d" 2>/dev/null || stat -c '%d' "$d" 2>/dev/null)"
done

# =============================================================================
sec "2. GIT METADATA FOR PROTECTED DIRECTORIES"
# =============================================================================
for d in "${PROTECTED_DIRS[@]}"; do
  printf '\n---------------- %s ----------------\n' "$d"
  if [[ ! -e $d ]]; then echo "RESULT: PATH DOES NOT EXIST on this host."; continue; fi
  echo "Exists. Owner/perms: $(stat -c '%U:%G %A  size=%s bytes' "$d" 2>/dev/null)"
  echo "Top-level entries : $(ls -1A "$d" 2>/dev/null | wc -l)"
  ls -la "$d" 2>/dev/null | head -30

  if [[ ! -d "$d/.git" ]]; then
    echo
    echo ">>> RESULT: NO .git DIRECTORY. This directory is NOT a Git working tree."
    echo ">>> It CANNOT pull, push, or report a commit. Do not claim Git history for it."
    echo ">>> Any deployment from here must be done by copy/rsync or by cloning fresh"
    echo ">>> into a SEPARATE staging directory."
    continue
  fi

  echo; echo "--- git metadata (read-only; NO fetch performed) ---"
  git -C "$d" rev-parse --is-inside-work-tree 2>&1
  echo "current branch : $(git -C "$d" rev-parse --abbrev-ref HEAD 2>&1)"
  echo "HEAD commit    : $(git -C "$d" rev-parse HEAD 2>&1)"
  echo "commit date    : $(git -C "$d" log -1 --format='%cI  %an  %s' 2>&1 | scrub)"
  echo "remotes (scrubbed):"; git -C "$d" remote -v 2>&1 | scrub
  echo "upstream track : $(git -C "$d" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>&1)"
  echo "local branches :"; git -C "$d" branch -vv 2>&1 | scrub | head -20
  echo "all refs       :"; git -C "$d" show-ref 2>&1 | scrub | head -20
  echo "tags           : $(git -C "$d" tag 2>/dev/null | wc -l)"
  echo
  echo "--- WORKING TREE STATUS (critical: uncommitted changes must NOT be discarded) ---"
  git -C "$d" status --porcelain=v1 -b 2>&1 | scrub | head -60
  DIRTY=$(git -C "$d" status --porcelain 2>/dev/null | wc -l)
  echo ">>> uncommitted change count: $DIRTY"
  if [[ "$DIRTY" -gt 0 ]]; then
    echo ">>> DIRTY TREE. Do NOT 'git reset --hard', 'git checkout .', 'git clean -fd'"
    echo ">>> or 'git pull' until these changes are reviewed and backed up."
    echo ">>> Diffstat (names only):"
    git -C "$d" diff --stat 2>&1 | tail -20 | scrub
    echo ">>> Untracked files that are NOT ignored (first 40):"
    git -C "$d" ls-files --others --exclude-standard 2>&1 | head -40 | scrub
  else
    echo ">>> Tree is CLEAN at this commit."
  fi
  echo
  echo "--- last 10 commits ---"; git -C "$d" log --oneline -10 2>&1 | scrub
  echo
  echo "--- is .env or any secret TRACKED by git here? (must be NO) ---"
  git -C "$d" ls-files 2>/dev/null | grep -iE '(^|/)\.env($|\.)|\.pem$|\.key$|\.crt$|\.p12$|\.pfx$|\.sql$|\.sqlite3?$|\.db$|\.alo\.bak$' \
    | sed 's/^/    TRACKED-SECRET-RISK: /' || echo "    none tracked (good)"
  echo "--- .gitignore present? ---"
  [[ -f "$d/.gitignore" ]] && sed 's/^/    /' "$d/.gitignore" || echo "    NO .gitignore (risk: secrets could be added)"
done

# =============================================================================
sec "3. APPLICATION MANIFESTS / RUNTIME STACK PER DIRECTORY"
# =============================================================================
for d in "${PROTECTED_DIRS[@]}" "${CANDIDATE_PATHS[@]}"; do
  [[ -d $d ]] || continue
  printf '\n---------------- %s ----------------\n' "$d"
  for f in package.json composer.json requirements.txt Gemfile go.mod bun.lock package-lock.json yarn.lock \
           prisma/schema.prisma Dockerfile docker-compose.yml docker-compose.yaml ecosystem.config.js \
           Caddyfile wp-config.php artisan manage.py next.config.ts next.config.js .nvmrc; do
    if [[ -e "$d/$f" ]]; then
      printf '  FOUND %-28s %s\n' "$f" "$(stat -c '%s bytes  mtime=%y' "$d/$f" 2>/dev/null | cut -d. -f1)"
    fi
  done
  # language/stack fingerprint without dumping file contents
  if [[ -f "$d/package.json" ]]; then
    echo "  package.json name/version/scripts:"
    node -e '
      const p=require(process.argv[1]);
      console.log("    name    :", p.name||"(none)");
      console.log("    version :", p.version||"(none)");
      console.log("    pm      :", p.packageManager||"(unset)");
      console.log("    engines :", JSON.stringify(p.engines||{}));
      console.log("    scripts :", Object.keys(p.scripts||{}).join(", ")||"(none)");
      const d={...p.dependencies,...p.devDependencies};
      const flag=["next","react","prisma","@prisma/client","express","nestjs","bun-types","tailwindcss","next-auth"];
      console.log("    keydeps :", flag.filter(k=>d[k]).map(k=>k+"@"+d[k]).join(", ")||"(none)");
    ' "$d/package.json" 2>/dev/null || echo "    (could not parse package.json)"
  fi
  if [[ -f "$d/prisma/schema.prisma" ]]; then
    echo "  prisma datasource (provider + env var NAME only, never the value):"
    grep -nE '^\s*(provider|url)\s*=' "$d/prisma/schema.prisma" | sed -E 's/env\("([A-Z_]+)"\)/env("\1")/' | sed 's/^/    /'
    echo "  prisma models: $(grep -c '^model ' "$d/prisma/schema.prisma" 2>/dev/null)"
    echo "  migrations dir: $([[ -d "$d/prisma/migrations" ]] && echo "PRESENT ($(ls -1 "$d/prisma/migrations" | wc -l) entries)" || echo 'ABSENT -> schema is applied with "prisma db push", not versioned migrations')"
  fi
  [[ -f "$d/composer.json" ]] && { echo "  PHP/Laravel detected:"; grep -oE '"(laravel/framework|php)"\s*:\s*"[^"]*"' "$d/composer.json" | sed 's/^/    /'; }
done

# =============================================================================
sec "4. RUNTIME VERSIONS INSTALLED"
# =============================================================================
for c in node npm bun npx yarn pnpm php composer python3 mysql mariadb psql sqlite3 \
         git pm2 docker nginx apache2 httpd caddy litespeed lsphp ffmpeg espeak; do
  if have "$c"; then printf '  %-12s %-40s %s\n' "$c" "$(command -v $c)" "$($c --version 2>&1 | head -1)"; else printf '  %-12s %s\n' "$c" "NOT INSTALLED"; fi
done
echo; echo "--- node/bun version managers ---"
ls -d /root/.nvm /home/*/.nvm /root/.bun /home/*/.bun 2>/dev/null || echo "  none found"

# =============================================================================
sec "5. RUNNING PROCESSES / SERVICES / CONTAINERS / PORTS"
# =============================================================================
echo "--- PID 1 / init system ---"; ps -p 1 -o comm= 2>/dev/null
echo; echo "--- systemd: enabled+running units (filtered to app/web/db) ---"
if have systemctl; then
  systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null \
    | awk '{print "  RUNNING  "$1}' | grep -iE 'nginx|apache|httpd|caddy|litespeed|lshttpd|mysql|maria|postgres|mongo|redis|pm2|node|bun|php|alo|learn' \
    || echo "  (no matching running services)"
  echo
  systemctl list-unit-files --type=service --state=enabled --no-pager --no-legend 2>/dev/null \
    | awk '{print "  ENABLED  "$1}' | head -40
  echo
  echo "--- systemd units mentioning ALO paths (these prove what is wired to boot) ---"
  grep -rilE 'alo|learn-app|ALO-LEARNING' /etc/systemd/system /lib/systemd/system 2>/dev/null | head -20 \
    | while read -r u; do echo "  UNIT: $u"; grep -nE 'ExecStart|WorkingDirectory|User=|EnvironmentFile' "$u" 2>/dev/null | scrub | sed 's/^/      /'; done
else
  echo "  systemctl not available"
fi
echo; echo "--- PM2 ---"
if have pm2; then
  pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);if(!a.length)return console.log("  PM2 running but ZERO processes");a.forEach(p=>console.log(`  ${p.name}\tstatus=${p.pm2_env?.status}\trestarts=${p.pm2_env?.restart_time}\tscript=${p.pm2_env?.pm_exec_path}\tcwd=${p.pm2_env?.pm_cwd}\tport=${p.pm2_env?.env?.PORT||"?"}\tuptime_since=${new Date(p.pm2_env?.pm_uptime||0).toISOString()}`))}catch(e){console.log("  (pm2 jlist not parseable: "+e.message+")")}})'
  pm2 ls 2>/dev/null | head -20
else echo "  pm2 NOT INSTALLED"; fi
echo; echo "--- Docker ---"
if have docker; then docker ps -a --format '  {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' 2>&1 | head -30; docker system df 2>&1 | head -10; else echo "  docker NOT INSTALLED"; fi
echo; echo "--- Listening TCP ports (who owns each) ---"
if have ss; then ss -tlnp 2>/dev/null | head -60; else netstat -tlnp 2>/dev/null | head -60; fi
echo; echo "--- Processes whose cmdline references an ALO path ---"
ps -eo pid,ppid,user,etimes,rss,args 2>/dev/null \
  | grep -iE 'alo|learn-app|ALO-LEARNING|next-server|standalone/server.js' | grep -v grep | scrub | head -30
echo; echo "--- cron (scheduled jobs can re-deploy or re-create files) ---"
crontab -l 2>/dev/null | scrub | sed 's/^/  root: /'
for u in /home/*; do [[ -d $u ]] && sudo -n -u "$(basename "$u")" crontab -l </dev/null 2>/dev/null | scrub | sed "s/^/  $(basename "$u"): /"; done   # sudo -n: never prompt
ls -la /etc/cron.d /etc/cron.daily 2>/dev/null | head -30
grep -rilE 'alo|learn-app' /etc/cron* /var/spool/cron 2>/dev/null | head -10 | sed 's/^/  CRON-REF: /'

# =============================================================================
sec "6. WEB SERVER / VIRTUAL HOSTS / DOCUMENT ROOTS / UPSTREAMS"
# =============================================================================
echo ">>> This section determines WHICH app serves the public site and the CRM."
echo ">>> Do not infer this from a single unused port."
echo
echo "--- Apache ---"
if have apache2ctl; then apache2ctl -S 2>&1 | head -40; elif have httpd; then httpd -S 2>&1 | head -40; else echo "  apache2ctl/httpd not found"; fi
for f in /etc/apache2/sites-enabled/* /etc/apache2/sites-available/* /etc/httpd/conf.d/*.conf; do
  [[ -f $f ]] || continue
  echo "  VHOST FILE: $f"
  grep -nE 'ServerName|ServerAlias|DocumentRoot|ProxyPass|ProxyPassReverse|SuexecUserGroup|<Directory' "$f" 2>/dev/null | scrub | sed 's/^/      /'
done
echo; echo "--- Nginx ---"
if have nginx; then
  nginx -T 2>/dev/null | grep -nE 'server_name|root |listen |proxy_pass|fastcgi_pass|include |upstream ' | scrub | head -80
else echo "  nginx not found"; fi
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf /etc/nginx/nginx.conf; do
  [[ -f $f ]] || continue
  echo "  NGINX FILE: $f"
  grep -nE 'server_name|root|listen|proxy_pass|fastcgi_pass|upstream|try_files' "$f" 2>/dev/null | scrub | sed 's/^/      /'
done
echo; echo "--- LiteSpeed / OpenLiteSpeed ---"
for f in /usr/local/lsws/conf/httpd_config.conf /usr/local/lsws/conf/vhosts/*/vhconf.conf; do
  [[ -f $f ]] || continue
  echo "  LSWS FILE: $f"
  grep -nE 'vhDomain|docRoot|extprocessor|address|vhAliases' "$f" 2>/dev/null | scrub | sed 's/^/      /'
done
have lshttpd && echo "  lshttpd binary present"
echo; echo "--- Caddy ---"
for f in /etc/caddy/Caddyfile /root/Caddyfile /home/*/Caddyfile /home/*/*/Caddyfile; do
  [[ -f $f ]] || continue
  echo "  CADDYFILE: $f"; scrub < "$f" | sed 's/^/      /' | head -40
done
echo; echo "--- cPanel / user docroots ---"
ls -la /home/*/public_html 2>/dev/null | head -20
for u in /var/cpanel/users/*; do [[ -f $u ]] && { echo "  CPANEL USER: $(basename "$u")"; grep -E '^DNS|^-A|^HOMEDIR|^USER' "$u" 2>/dev/null | scrub | sed 's/^/      /'; }; done

echo; echo ">>> Document-root inventory: which directories are actually referenced by a vhost"
for d in "${CANDIDATE_PATHS[@]}" "${PROTECTED_DIRS[@]}"; do
  [[ -d $d ]] || continue
  REFS=$(grep -rilE "$(printf '%s' "$d" | sed 's/[][\.*^$/]/\\&/g')" /etc/apache2 /etc/nginx /etc/httpd /usr/local/lsws/conf /etc/caddy /etc/systemd/system 2>/dev/null | tr '\n' ' ')
  if [[ -n "${REFS// /}" ]]; then echo "  LIVE-REFERENCED : $d"; echo "                    by: $REFS"; else echo "  not referenced  : $d"; fi
done

# =============================================================================
sec "7. HTTP HEALTH CHECKS — WHAT ACTUALLY ANSWERS"
# =============================================================================
echo ">>> Evidence-based. Each check prints HTTP status + a content fingerprint."
probe() { # url label
  local url="$1" label="$2" code body
  code=$(curl -sS -o /tmp/.alo_probe_body -w '%{http_code}' --max-time 12 -k "$url" 2>/dev/null)
  body=$(head -c 400 /tmp/.alo_probe_body 2>/dev/null | tr -d '\0' | tr '\n' ' ')
  printf '  %-52s HTTP %-4s | %s\n' "$label [$url]" "${code:-ERR}" "$(echo "$body" | cut -c1-150)"
  rm -f /tmp/.alo_probe_body
}
echo "--- localhost ports found listening above ---"
for p in 3000 3017 80 443 8080 8081 8888 7080 5000 4000; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then
    exec 3>&- 3<&-
    probe "http://127.0.0.1:$p/" "port $p root"
    probe "http://127.0.0.1:$p/api/health" "port $p /api/health"
  fi
done
echo; echo "--- public domains (add/remove to match real DNS) ---"
for h in aloeducation.com www.aloeducation.com learn.aloeducation.com crm.aloeducation.com app.aloeducation.com admin.aloeducation.com; do
  ip=$(getent hosts "$h" 2>/dev/null | awk '{print $1; exit}')
  echo "  DNS $h -> ${ip:-NO-RESOLUTION}"
  [[ -n $ip ]] && { probe "http://$h/" "$h http"; probe "https://$h/" "$h https"; }
done
echo; echo "--- which of MY IPs does DNS point at? ---"
echo "  server IPv4: $(hostname -I 2>/dev/null)"
curl -sS --max-time 8 https://api.ipify.org 2>/dev/null | sed 's/^/  public egress IP: /' || echo "  (no egress or ipify unreachable)"

# =============================================================================
sec "8. DATABASE — TYPE / TARGET / MIGRATION STATE / BACKUPS  (no secrets printed)"
# =============================================================================
echo "--- DB servers running locally ---"
if have mysql || have mariadb; then
  echo "  mysql client present."
  mysql --version 2>/dev/null | sed 's/^/    /'
  echo "  databases (requires auth; failures are expected and safe):"
  # </dev/null + --connect-timeout: never hang on an auth prompt on a live box
  mysql -N -B --connect-timeout=5 -e 'select schema_name, round(sum(data_length+index_length)/1024/1024,1) as mb from information_schema.schemata s left join information_schema.tables t on t.table_schema=s.schema_name group by 1;' </dev/null 2>&1 | head -20 | sed 's/^/    /'
fi
have psql && { echo "  postgres client present."; psql -l 2>&1 | head -20 | sed 's/^/    /'; }
echo "  sqlite DB files on disk:"
find /root /home /var/www /opt -maxdepth 6 \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) \
     -not -path '*/node_modules/*' -printf '    %10s  %TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null | sort -rn | head -30
echo
echo "--- Configured connection TARGET (scheme/host/db only — password stripped) ---"
for d in "${PROTECTED_DIRS[@]}" "${CANDIDATE_PATHS[@]}" "/home/aloedu/learn-app"; do
  for f in "$d/.env" "$d/.env.production" "$d/.env.local" "$d/.env.save"; do
    [[ -f $f ]] || continue
    echo "  FILE: $f   (perms $(stat -c '%A %U:%G' "$f" 2>/dev/null))"
    echo "    variable NAMES only:"
    grep -oE '^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*=' "$f" 2>/dev/null | sed -E 's/^[[:space:]]*//; s/=$//; s/^export //; s/^/      - /' | sort -u
    echo "    DATABASE_URL shape (credentials removed):"
    grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' "$f" 2>/dev/null \
      | sed -E 's#=.*://#=//#; s#(//)[^/@]*@#\1***@#; s#:[^:@/]*@#:***@#' | sed 's/^/      /' \
      || echo "      (no DATABASE_URL)"
  done
done
echo
echo "--- .env permission hygiene (should be 600 and owned by the app user) ---"
find /root /home /var/www -maxdepth 4 -name '.env*' -not -path '*/node_modules/*' -printf '    %M %u:%g  %p\n' 2>/dev/null | head -30
echo
echo "--- Prisma migration state per project ---"
for d in "${PROTECTED_DIRS[@]}" "/home/aloedu/learn-app"; do
  [[ -d "$d/prisma" ]] || continue
  echo "  $d"
  echo "    migrations dir : $([[ -d "$d/prisma/migrations" ]] && echo present || echo 'ABSENT (db push workflow — no versioned history)')"
  echo "    migration lock : $([[ -f "$d/prisma/migrations/migration_lock.toml" ]] && echo present || echo absent)"
done
echo
echo "--- Backup availability (existence/size/age only; contents NOT read) ---"
find /root /home /var /opt /backup /backups -maxdepth 5 \
     \( -iname '*.sql' -o -iname '*.sql.gz' -o -iname '*.dump' -o -iname '*.bak' -o -iname '*.alo.bak' \
        -o -iname '*backup*.zip' -o -iname '*backup*.tar*' \) \
     -not -path '*/node_modules/*' -printf '    %10s  %TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null | sort -k2 -r | head -40
echo "  --- off-server / independent backup evidence (cron, rclone, restic, borg) ---"
for c in rclone restic borg aws gcloud; do have "$c" && echo "    $c installed -> check its config for offsite copies"; done
ls -la /etc/cron.d/*backup* /etc/cron.daily/*backup* 2>/dev/null | sed 's/^/    /'

# =============================================================================
sec "9. LARGEST DIRECTORIES AND FILES"
# =============================================================================
for r in "${SCAN_ROOTS[@]}"; do
  [[ -d $r ]] || continue
  echo; echo "--- top-level of $r ---"
  du -xsh "$r"/* "$r"/.[!.]* 2>/dev/null | sort -rh | head -20
done
echo; echo "--- 25 largest FILES across app paths (excl. node_modules) ---"
find "${SCAN_ROOTS[@]}" -xdev -type f -size +50M -not -path '*/node_modules/*' \
     -printf '%10s  %TY-%Tm-%Td  %p\n' 2>/dev/null | sort -rn | head -25 \
     | awk '{printf "  %8.1f MB  %s  %s\n", $1/1048576, $2, substr($0, index($0,$3))}'
echo; echo "--- 25 largest DIRECTORIES (depth-limited, excl. node_modules) ---"
for r in "${SCAN_ROOTS[@]}"; do [[ -d $r ]] && du -xh --max-depth=3 "$r" 2>/dev/null; done \
  | grep -v node_modules | sort -rh | head -25
echo; echo "--- node_modules footprint (usually the biggest reclaimable item) ---"
find "${SCAN_ROOTS[@]}" -xdev -maxdepth 5 -type d -name node_modules 2>/dev/null \
  | while read -r n; do printf '  %8s  %s\n' "$(du -xsh "$n" 2>/dev/null | cut -f1)" "$n"; done | sort -rh | head -20

# =============================================================================
sec "10. DUPLICATE ARCHIVES / DIRECTORIES"
# =============================================================================
echo "--- All archive files, grouped by size (size-equality is a cheap duplicate hint) ---"
find "${SCAN_ROOTS[@]}" -xdev -type f \( -iname '*.zip' -o -iname '*.tar' -o -iname '*.tar.gz' -o -iname '*.tgz' -o -iname '*.rar' -o -iname '*.7z' -o -iname '*.sql.gz' \) \
     -not -path '*/node_modules/*' -printf '%10s  %TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null | sort -rn | head -40
echo
echo "--- Same-basename archives in different locations (candidate duplicates) ---"
find "${SCAN_ROOTS[@]}" -xdev -type f \( -iname '*.zip' -o -iname '*.tar.gz' -o -iname '*.tgz' \) -not -path '*/node_modules/*' -printf '%f\n' 2>/dev/null \
  | sort | uniq -d | sed 's/^/  DUP-NAME: /'
echo
if [[ $DO_CHECKSUMS -eq 1 ]]; then
  echo "--- SHA-256 of archives (SLOW, read-only) ---"
  find "${SCAN_ROOTS[@]}" -xdev -type f \( -iname '*.zip' -o -iname '*.tar.gz' -o -iname '*.tgz' \) -not -path '*/node_modules/*' -size +10M -print0 2>/dev/null \
    | xargs -0 -r -P1 -n1 sha256sum 2>/dev/null | sort | tee "$OUT/checksums-$TS.txt" | sed 's/^/  /'
  echo "--- identical-content groups (SAME checksum => true duplicates) ---"
  awk '{print $1}' "$OUT/checksums-$TS.txt" | sort | uniq -d | while read -r h; do
    echo "  IDENTICAL GROUP $h"; grep "^$h" "$OUT/checksums-$TS.txt" | sed 's/^/      /'
  done
else
  echo "--- SHA-256 SKIPPED. Re-run with --checksums to prove byte-identity."
  echo "    Size equality alone is NOT proof of identical content."
fi
echo
echo "--- Duplicate-looking DIRECTORIES (same basename, different parents) ---"
for r in "${SCAN_ROOTS[@]}"; do [[ -d $r ]] && find "$r" -xdev -maxdepth 3 -type d -not -path '*/node_modules*' -printf '%f\n' 2>/dev/null; done \
  | sort | uniq -cd | sort -rn | head -20 | sed 's/^/  /'

# =============================================================================
sec "11. CLEANUP CANDIDATE EVIDENCE SHEET (fill in per path)"
# =============================================================================
for d in "${CANDIDATE_PATHS[@]}"; do
  printf '\n---------------- %s ----------------\n' "$d"
  if [[ ! -e $d ]]; then echo "  DOES NOT EXIST — nothing to clean, remove from the candidate list."; continue; fi
  echo "  type           : $([[ -d $d ]] && echo directory || echo file)"
  echo "  size           : $(du -xsh "$d" 2>/dev/null | cut -f1)"
  echo "  mtime          : $(stat -c '%y' "$d" 2>/dev/null | cut -d. -f1)"
  echo "  atime (last read — a live docroot gets read constantly): $(stat -c '%x' "$d" 2>/dev/null | cut -d. -f1)"
  echo "  owner          : $(stat -c '%U:%G %A' "$d" 2>/dev/null)"
  echo "  has .git       : $([[ -d "$d/.git" ]] && echo YES || echo no)"
  echo "  has node_modules: $([[ -d "$d/node_modules" ]] && echo YES || echo no)"
  echo "  has .env       : $([[ -f "$d/.env" ]] && echo 'YES  <-- SECRETS: never add to git, never quarantine without care' || echo no)"
  echo "  referenced by a vhost/systemd/cron? :"
  grep -rilE "$(printf '%s' "$d" | sed 's/[][\.*^$/]/\\&/g')" /etc/apache2 /etc/nginx /etc/httpd /usr/local/lsws/conf /etc/caddy /etc/systemd/system /etc/cron* 2>/dev/null \
    | sed 's/^/      REFERENCED-BY: /' || echo "      no config references found"
  echo "  any running process cwd/exe inside it? :"
  for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null); exe=$(readlink "/proc/$pid/exe" 2>/dev/null)
    case "$cwd$exe" in *"$d"*) echo "      IN-USE by PID $pid  cwd=$cwd exe=$exe";; esac
  done
  echo "  open file handles inside it (lsof) :"
  have lsof && lsof +D "$d" 2>/dev/null | head -5 | sed 's/^/      /' || echo "      (lsof unavailable or none)"
  echo "  VERDICT: ____ (live / release / backup / archive / unknown)  -- decided by a human, not by this script"
done

hr
echo "AUDIT COMPLETE. Report saved to: $REPORT"
[[ $DO_CHECKSUMS -eq 1 ]] && echo "Checksums saved to: $OUT/checksums-$TS.txt"
echo
echo "NEXT STEP: review the report, then run cleanup-quarantine.sh in DRY-RUN mode."
echo "Nothing was modified by this script."
hr
