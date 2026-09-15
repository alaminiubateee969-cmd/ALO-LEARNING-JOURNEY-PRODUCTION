#!/usr/bin/env bash
# =============================================================================
# ALO Education VPS — RECLAIM REGENERABLE SPACE  (dry run by default)
# -----------------------------------------------------------------------------
# Scope, deliberately narrow: this script ONLY targets artefacts that can be
# rebuilt or that are pure cache. It does NOT touch source, databases, archives,
# SSL, secrets, document roots, or anything a service is using.
#
#   node_modules/   .next/   .turbo/   .cache/   coverage/
#   package-manager caches (~/.bun, ~/.npm, ~/.cache/pip, /var/cache/apt)
#   PM2 logs, journald vacuum, rotated web logs
#
# Why this is the safe first pass: it is usually the largest single win, and
# every item is reproducible from a lockfile or is a cache by definition. Nothing
# here needs a checksum, an offsite backup, or a quarantine period.
#
# THREE SAFETY PROPERTIES WORTH UNDERSTANDING:
#
#  1. LIVE directories are never touched. A node_modules belonging to a running
#     app is not reclaimable — deleting it breaks the process even though the
#     code is "regenerable". Liveness is detected from vhost DocumentRoots,
#     nginx roots, LiteSpeed docRoots, systemd WorkingDirectory/ExecStart, PM2
#     pm_cwd/pm_exec_path, /home/*/public_html, and every /proc/<pid>/cwd.
#
#  2. A project's node_modules is only removed if a LOCKFILE exists next to it.
#     Without a lockfile, `bun install` would resolve fresh semver ranges and the
#     regenerated tree could differ from what was running. That is not a
#     "regenerable" artefact any more — it is a dependency-drift risk.
#
#  3. LOGS ARE TRUNCATED, NEVER DELETED. `rm` on a file a running process holds
#     open frees NOTHING until that process closes the descriptor — the classic
#     "df says full but du says fine" trap. Truncating (`: > file`) releases the
#     space immediately and keeps the inode valid for the writer. PM2 logs are
#     flushed with `pm2 flush` and journald with `--vacuum-size` for the same
#     reason: those are the tools that own the descriptors.
#
# Usage:
#   sudo bash reclaim-regenerable.sh                  # dry run, report only
#   sudo bash reclaim-regenerable.sh --execute        # perform the reclaim
#   sudo bash reclaim-regenerable.sh --include-docker # also prune Docker (opt-in)
#   sudo bash reclaim-regenerable.sh --keep-live      # (default) never touch live
#
# This script DOES delete — that is the point of reclaiming space — but only
# within the narrow regenerable scope above, and only after the liveness and
# lockfile gates. For everything else use cleanup-quarantine.sh, which never
# deletes at all.
# =============================================================================
set -uo pipefail

if [[ -z "${BASH_VERSINFO:-}" || ${BASH_VERSINFO[0]} -lt 4 ]]; then
  echo "FATAL: bash 4+ required (found ${BASH_VERSION:-unknown})." >&2
  exit 1
fi

MODE="dry-run"; INCLUDE_DOCKER=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute)        MODE="execute"; shift ;;
    --include-docker) INCLUDE_DOCKER=1; shift ;;
    -h|--help)        sed -n '2,45p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1"; exit 2 ;;
  esac
done

TS="$(date -u +%Y%m%d-%H%M%SZ)"
OUT="${ALO_AUDIT_OUT:-/root/ALO-LEARNING-JOURNEY/audit}"
mkdir -p "$OUT" 2>/dev/null || OUT="/tmp"; 
REPORT="$OUT/reclaim-$TS.txt"
SCAN_ROOTS=(/root /home /var/www /opt /srv)

# Directories that must never be scanned into, let alone cleaned.
NEVER_ENTER=(/var/lib/mysql /var/lib/postgresql /var/lib/docker /etc /proc /sys
             /dev /boot /run /var/run)

have(){ command -v "$1" >/dev/null 2>&1; }
human(){ du -sh "$1" 2>/dev/null | cut -f1; }
bytes(){ du -sb "$1" 2>/dev/null | cut -f1 || echo 0; }

exec > >(tee -a "$REPORT") 2>&1

echo "ALO REGENERABLE-SPACE RECLAIM — MODE: $MODE"
echo "Time (UTC)   : $TS"
echo "Report       : $REPORT"
echo "Docker prune : $([[ $INCLUDE_DOCKER -eq 1 ]] && echo 'ENABLED (opt-in)' || echo disabled)"
[[ $MODE == execute ]] && echo "*** EXECUTE MODE: regenerable artefacts WILL be deleted/truncated. ***"

echo; echo "=== Disk before ==="
df -hT -x tmpfs -x devtmpfs 2>/dev/null
BEFORE_KB=$(df -k --output=used / 2>/dev/null | tail -1 | tr -d ' ')
echo "used(KB) before: ${BEFORE_KB:-unknown}"

# -----------------------------------------------------------------------------
# 1. Detect LIVE paths (same evidence model as cleanup-quarantine.sh)
# -----------------------------------------------------------------------------
declare -A LIVE=()
add_live(){ [[ -n "${1:-}" ]] && LIVE["$1"]="${2:-detected}"; }

for f in /etc/apache2/sites-enabled/* /etc/httpd/conf.d/*.conf; do
  [[ -f $f ]] || continue
  while read -r p; do add_live "$p" "apache:$f"; done \
    < <(grep -rhoiE '^[[:space:]]*DocumentRoot[[:space:]]+[^[:space:]]+' "$f" 2>/dev/null | awk '{print $2}' | tr -d '"')
done
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf /etc/nginx/nginx.conf; do
  [[ -f $f ]] || continue
  while read -r p; do add_live "$p" "nginx:$f"; done \
    < <(grep -rhoE '^[[:space:]]*root[[:space:]]+[^;]+' "$f" 2>/dev/null | awk '{print $2}' | tr -d '";')
done
have nginx && while read -r p; do add_live "$p" "nginx:-T"; done \
  < <(nginx -T 2>/dev/null | grep -oE '^[[:space:]]*root[[:space:]]+[^;]+' | awk '{print $2}' | tr -d '";')
for f in /usr/local/lsws/conf/httpd_config.conf /usr/local/lsws/conf/vhosts/*/vhconf.conf; do
  [[ -f $f ]] || continue
  while read -r p; do add_live "$p" "litespeed:$f"; done \
    < <(grep -rhoE 'docRoot[[:space:]]+[^[:space:]]+' "$f" 2>/dev/null | awk '{print $2}')
done
while read -r p; do [[ -e $p ]] && add_live "$p" "systemd-unit"; done \
  < <(grep -rhoE '^(WorkingDirectory|ExecStart)=[^[:space:]]+' /etc/systemd/system /lib/systemd/system 2>/dev/null \
      | sed -E 's/^(WorkingDirectory|ExecStart)=//' | awk '{print $1}')
if have pm2; then
  while read -r p; do add_live "$p" "pm2"; done \
    < <(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s).forEach(p=>{const e=p.pm2_env||{};[e.pm_cwd,e.pm_exec_path].filter(Boolean).forEach(x=>console.log(x))})}catch(_){}})' 2>/dev/null)
fi
for p in /home/*/public_html; do [[ -d $p ]] && add_live "$p" "cpanel-docroot"; done
for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
  p=$(readlink "/proc/$pid/cwd" 2>/dev/null)
  [[ -n $p && $p != "/" ]] && add_live "$p" "proc:$pid-cwd"
done

echo; echo "=== LIVE paths (never cleaned) ==="
if [[ ${#LIVE[@]} -gt 0 ]]; then
  for k in "${!LIVE[@]}"; do printf '  %-52s <- %s\n' "$k" "${LIVE[$k]}"; done
else
  echo "  (none detected — on a production box this is suspicious; verify web/service config first)"
fi

# A path is protected if it IS live, is INSIDE a live path, or CONTAINS one.
is_protected(){
  local p="$1" k
  [[ -n "${LIVE[$p]:-}" ]] && { echo "is live (${LIVE[$p]})"; return 0; }
  if [[ ${#LIVE[@]} -gt 0 ]]; then
    for k in "${!LIVE[@]}"; do
      [[ "$p" == "$k"/* ]] && { echo "inside live path $k"; return 0; }
      [[ "$k" == "$p"/* ]] && { echo "contains live path $k (${LIVE[$k]})"; return 0; }
    done
  fi
  for n in "${NEVER_ENTER[@]}"; do
    [[ "$p" == "$n" || "$p" == "$n"/* ]] && { echo "inside protected system path $n"; return 0; }
  done
  return 1
}

# -----------------------------------------------------------------------------
# 2. Find regenerable build artefacts
# -----------------------------------------------------------------------------
echo; echo "=== Regenerable build artefacts ==="
printf '  %-9s %-11s %s\n' "SIZE" "VERDICT" "PATH"
TOTAL_BYTES=0
PLAN=()   # "action<TAB>path<TAB>bytes<TAB>regen-cmd"

while IFS= read -r -d '' d; do
  proj="$(dirname "$d")"
  base="$(basename "$d")"
  sz=$(bytes "$d"); TOTAL_BYTES=$((TOTAL_BYTES + sz))

  if why=$(is_protected "$proj"); then
    printf '  %-9s %-11s %s\n' "$(human "$d")" "SKIP-LIVE" "$d  ($why)"
    continue
  fi

  case "$base" in
    node_modules)
      # Gate: a lockfile must exist so the tree can be rebuilt deterministically.
      lock=""
      for l in bun.lock bun.lockb package-lock.json yarn.lock pnpm-lock.yaml; do
        [[ -f "$proj/$l" ]] && { lock="$l"; break; }
      done
      if [[ -z $lock ]]; then
        printf '  %-9s %-11s %s\n' "$(human "$d")" "SKIP-NOLOCK" "$d  (no lockfile in $proj — reinstalling would drift dependencies)"
        continue
      fi
      printf '  %-9s %-11s %s\n' "$(human "$d")" "REMOVABLE" "$d  (regenerate: cd $proj && bun install --frozen-lockfile)"
      PLAN+=("rm	$d	$sz	cd $proj && bun install --frozen-lockfile   # lockfile: $lock")
      ;;
    .next|.turbo|.cache|coverage)
      printf '  %-9s %-11s %s\n' "$(human "$d")" "REMOVABLE" "$d  (build cache — regenerated by 'bun run build')"
      PLAN+=("rm	$d	$sz	cd $proj && bun run build")
      ;;
  esac
done < <(find "${SCAN_ROOTS[@]}" -xdev -type d \
            \( -name node_modules -o -name .next -o -name .turbo -o -name coverage \) \
            -prune -print0 2>/dev/null)

# .cache dirs are matched separately: they can appear at any depth and are
# always safe to clear, but we still refuse inside live paths.
while IFS= read -r -d '' d; do
  if why=$(is_protected "$d"); then
    printf '  %-9s %-11s %s\n' "$(human "$d")" "SKIP-LIVE" "$d  ($why)"; continue
  fi
  sz=$(bytes "$d"); TOTAL_BYTES=$((TOTAL_BYTES + sz))
  printf '  %-9s %-11s %s\n' "$(human "$d")" "REMOVABLE" "$d  (cache)"
  PLAN+=("rm	$d	$sz	cache — no regeneration needed")
done < <(find "${SCAN_ROOTS[@]}" -xdev -maxdepth 4 -type d -name .cache -prune -print0 2>/dev/null)

# -----------------------------------------------------------------------------
# 3. Package-manager and system caches (always safe, never inside a project)
# -----------------------------------------------------------------------------
echo; echo "=== Package-manager / system caches ==="
for c in /root/.bun/install/cache /home/*/.bun/install/cache \
         /root/.npm/_cacache /home/*/.npm/_cacache \
         /root/.cache/pip /home/*/.cache/pip; do
  for d in $c; do
    [[ -d $d ]] || continue
    sz=$(bytes "$d")
    printf '  %-9s %-11s %s\n' "$(human "$d")" "REMOVABLE" "$d"
    TOTAL_BYTES=$((TOTAL_BYTES + sz))
    PLAN+=("rm	$d	$sz	package cache — re-downloaded on next install")
  done
done
if [[ -d /var/cache/apt/archives ]]; then
  sz=$(bytes /var/cache/apt/archives)
  printf '  %-9s %-11s %s\n' "$(human /var/cache/apt/archives)" "REMOVABLE" "/var/cache/apt/archives  (via apt-get clean)"
  TOTAL_BYTES=$((TOTAL_BYTES + sz))
  PLAN+=("aptclean	/var/cache/apt/archives	$sz	apt-get clean")
fi

# -----------------------------------------------------------------------------
# 4. Logs — TRUNCATE, never rm (open descriptors hold the space otherwise)
# -----------------------------------------------------------------------------
echo; echo "=== Logs (truncate, never delete) ==="
LOG_BYTES=0
add_log(){ # path
  [[ -f $1 ]] || return 0
  local sz; sz=$(stat -c %s "$1" 2>/dev/null || echo 0)
  (( sz < 1048576 )) && return 0          # ignore anything under 1 MB
  if why=$(is_protected "$(dirname "$1")"); then
    printf '  %-9s %-11s %s\n' "$(numfmt --to=iec-i --suffix=B "$sz" 2>/dev/null || echo "$sz")" "SKIP-LIVE" "$1 ($why)"
    return 0
  fi
  printf '  %-9s %-11s %s\n' "$(numfmt --to=iec-i --suffix=B "$sz" 2>/dev/null || echo "$sz")" "TRUNCATE" "$1"
  LOG_BYTES=$((LOG_BYTES + sz)); TOTAL_BYTES=$((TOTAL_BYTES + sz))
  PLAN+=("truncate	$1	$sz	truncated in place; inode kept valid for the writer")
}
while IFS= read -r f; do add_log "$f"; done < <(find "${SCAN_ROOTS[@]}" /var/log -xdev -type f \
    \( -name '*.log' -o -name '*.log.[0-9]*' -o -name '*-access.log*' -o -name '*-error.log*' \
       -o -name 'dev.log' -o -name 'server.log' \) -size +1M 2>/dev/null | head -60)
# Rotated/compressed logs are safe to remove outright (no process holds them).
while IFS= read -r f; do
  [[ -f $f ]] || continue
  sz=$(stat -c %s "$f" 2>/dev/null || echo 0)
  if why=$(is_protected "$(dirname "$f")"); then continue; fi
  printf '  %-9s %-11s %s\n' "$(numfmt --to=iec-i --suffix=B "$sz" 2>/dev/null || echo "$sz")" "REMOVABLE" "$f  (already rotated)"
  TOTAL_BYTES=$((TOTAL_BYTES + sz))
  PLAN+=("rm	$f	$sz	rotated archive of a log")
done < <(find /var/log -xdev -type f \( -name '*.gz' -o -name '*.old' -o -name '*.[0-9]' \) -size +1M 2>/dev/null | head -40)

if have pm2; then
  pm2size=$(du -sb /root/.pm2/logs /home/*/.pm2/logs 2>/dev/null | awk '{s+=$1} END{print s+0}')
  if (( pm2size > 1048576 )); then
    printf '  %-9s %-11s %s\n' "$(numfmt --to=iec-i --suffix=B "$pm2size" 2>/dev/null)" "PM2-FLUSH" "~/.pm2/logs  (pm2 owns these descriptors)"
    TOTAL_BYTES=$((TOTAL_BYTES + pm2size))
    PLAN+=("pm2flush	~/.pm2/logs	$pm2size	pm2 flush")
  fi
fi
if have journalctl; then
  jsize=$(journalctl --disk-usage 2>/dev/null | grep -oE '[0-9.]+[KMGT]?B' | head -1)
  echo "  journald disk usage: ${jsize:-unknown}  (vacuum to 200M — journald owns these files)"
  PLAN+=("journal	journald	0	journalctl --vacuum-size=200M")
fi

# -----------------------------------------------------------------------------
# 5. Docker — OPT-IN only
# -----------------------------------------------------------------------------
if [[ $INCLUDE_DOCKER -eq 1 ]] && have docker; then
  echo; echo "=== Docker (opt-in) ==="
  docker system df 2>/dev/null
  PLAN+=("docker	docker	0	docker system prune -af --volumes   # DESTRUCTIVE to unused images/volumes")
else
  echo; echo "=== Docker: skipped (pass --include-docker to enable) ==="
fi

# -----------------------------------------------------------------------------
# 6. Summary and plan
# -----------------------------------------------------------------------------
echo; echo "==============================================================================="
echo "TOTAL RECLAIMABLE (regenerable scope only): $(numfmt --to=iec-i --suffix=B "$TOTAL_BYTES" 2>/dev/null || echo "$TOTAL_BYTES bytes")"
echo "  of which logs to truncate: $(numfmt --to=iec-i --suffix=B "$LOG_BYTES" 2>/dev/null || echo "$LOG_BYTES bytes")"
echo "Planned operations: ${#PLAN[@]}"
echo
printf '%-9s %-46s %s\n' "ACTION" "PATH" "REGENERATE / METHOD"
if [[ ${#PLAN[@]} -gt 0 ]]; then
  for e in "${PLAN[@]}"; do
    IFS=$'\t' read -r a p b r <<<"$e"
    printf '%-9s %-46s %s\n' "$a" "$p" "$r"
  done
else
  echo "  (nothing qualified)"
fi

if [[ $MODE != execute ]]; then
  echo
  echo "DRY RUN COMPLETE — nothing was deleted or truncated."
  echo "Report: $REPORT"
  echo "Re-run with --execute to apply."
  exit 0
fi

# -----------------------------------------------------------------------------
# 7. Execute
# -----------------------------------------------------------------------------
echo; echo "=== EXECUTING ==="
for e in ${PLAN[@]+"${PLAN[@]}"}; do
  IFS=$'\t' read -r a p b r <<<"$e"
  # Re-verify liveness immediately before acting; state may have changed.
  case "$a" in
    rm)
      if why=$(is_protected "$p"); then echo "  SKIP $p ($why)"; continue; fi
      [[ -e $p ]] || { echo "  SKIP $p (already gone)"; continue; }
      if rm -rf -- "$p" 2>/dev/null; then echo "  REMOVED  $p"; else echo "  FAILED   $p (left untouched)"; fi
      ;;
    truncate)
      if why=$(is_protected "$(dirname "$p")"); then echo "  SKIP $p ($why)"; continue; fi
      [[ -f $p ]] || continue
      if : > "$p" 2>/dev/null; then echo "  TRUNCATED $p"; else echo "  FAILED    $p"; fi
      ;;
    aptclean)   have apt-get && { apt-get clean -y >/dev/null 2>&1 && echo "  apt-get clean done"; } ;;
    pm2flush)   have pm2 && { pm2 flush >/dev/null 2>&1 && echo "  pm2 flush done"; } ;;
    journal)    have journalctl && { journalctl --vacuum-size=200M >/dev/null 2>&1 && echo "  journald vacuumed to 200M"; } ;;
    docker)     echo "  Docker prune is destructive — run manually after reading: $r" ;;
  esac
done

echo; echo "=== Disk after ==="
df -hT -x tmpfs -x devtmpfs 2>/dev/null
AFTER_KB=$(df -k --output=used / 2>/dev/null | tail -1 | tr -d ' ')
if [[ -n "${BEFORE_KB:-}" && -n "${AFTER_KB:-}" ]]; then
  echo "used(KB) before: $BEFORE_KB"
  echo "used(KB) after : $AFTER_KB"
  echo "RECLAIMED      : $(numfmt --to=iec-i --suffix=B $(( (BEFORE_KB - AFTER_KB) * 1024 )) 2>/dev/null || echo "$(( (BEFORE_KB - AFTER_KB) )) KB")"
fi

echo; echo "=== POST-RECLAIM HEALTH CHECKS (run these before considering it done) ==="
have pm2 && pm2 ls 2>/dev/null | head -12
for u in "http://127.0.0.1:${PORT:-3017}/api/health" "http://127.0.0.1/"; do
  printf '  %-45s HTTP %s\n' "$u" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 -k "$u" 2>/dev/null || echo ERR)"
done
echo
echo "If the app now fails to start, it needed a node_modules that was removed:"
echo "  cd <project> && bun install --frozen-lockfile && bun run build && pm2 restart alo-learning-journey"
echo "Every removed path and its regeneration command are in $REPORT."
