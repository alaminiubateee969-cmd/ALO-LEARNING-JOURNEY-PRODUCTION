#!/usr/bin/env bash
# =============================================================================
# ALO Education VPS — STAGED, REVERSIBLE CLEANUP  (quarantine, never delete)
# -----------------------------------------------------------------------------
# Design rules enforced by this script:
#   1. DEFAULT IS DRY RUN. Nothing moves unless you pass --execute.
#   2. It NEVER runs rm. Obsolete items are MOVED into a dated quarantine
#      directory on the SAME filesystem, so a restore is a single mv back.
#   3. A HARD-BLOCKED list can never be quarantined, even if explicitly named:
#      public_html, live document roots, SSL directories, .env / secrets,
#      database files, systemd WorkingDirectory targets, and anything a
#      running process has as its cwd or open file.
#   4. An item only becomes a quarantine CANDIDATE when evidence shows it is
#      not live: no vhost/systemd/cron reference, not in use by a process,
#      and (for archives) either byte-identical to another surviving copy,
#      or explicitly acknowledged by a human via --allow-unverified.
#   5. Duplicates are proven with SHA-256, never by name or size alone.
#      /root/ALO-FULL-SOURCE 2.zip is NEVER treated as removable just because
#      another copy exists — the surviving copy must be checksum-identical AND
#      outside the quarantine.
#   6. After any move it re-runs health checks and prints the rollback command.
#
# Usage:
#   sudo bash cleanup-quarantine.sh                      # dry run, proposal only
#   sudo bash cleanup-quarantine.sh --checksums          # dry run + prove duplicates
#   sudo bash cleanup-quarantine.sh --execute            # perform the moves
#   sudo bash cleanup-quarantine.sh --execute --only "/root/alo-live"
#
# Permanent deletion is a SEPARATE, later step: see purge-quarantine.sh
# (deliberately not part of this script).
# =============================================================================
set -uo pipefail

# Requires bash 4+ (associative arrays). CentOS/Alma 7 ships bash 4.2, which is
# fine; macOS's default bash 3.2 is NOT. Fail loudly rather than misbehave.
if [[ -z "${BASH_VERSINFO:-}" || ${BASH_VERSINFO[0]} -lt 4 ]]; then
  echo "FATAL: bash 4+ required (found ${BASH_VERSION:-unknown}). Run with a newer bash." >&2
  exit 1
fi

MODE="dry-run"; DO_CHECKSUMS=0; ALLOW_UNVERIFIED=0; ONLY_PATH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute)            MODE="execute"; shift ;;
    --checksums)          DO_CHECKSUMS=1; shift ;;
    --allow-unverified)   ALLOW_UNVERIFIED=1; shift ;;
    --only)               ONLY_PATH="${2:-}"; shift 2 ;;
    -h|--help)            sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1"; exit 2 ;;
  esac
done

TS="$(date -u +%Y%m%d-%H%M%SZ)"
QUAR_ROOT="${ALO_QUARANTINE_ROOT:-/root/.alo-quarantine}"
QUAR_DIR="$QUAR_ROOT/$TS"
OUT="${ALO_AUDIT_OUT:-/root/ALO-LEARNING-JOURNEY/audit}"
mkdir -p "$OUT" 2>/dev/null || OUT="/tmp/alo-audit-$TS"; mkdir -p "$OUT" 2>/dev/null || OUT="/tmp"
PROPOSAL="$OUT/cleanup-proposal-$TS.md"
MANIFEST="$QUAR_DIR/manifest.tsv"

# --- operator-supplied candidate list (re-measured, never trusted blindly) ----
CANDIDATES=(
  "/root/alo-live"
  "/root/alo-live-new"
  "/root/alo-github-main"
  "/var/www/alo-education"
  "/var/www/alo-education_vps"
  "/home/aloeduca/alo-education"
  "/root/ALO-FULL-SOURCE 2.zip"
  "/home/aloeduca/ALO-FULL-SOURCE 2.zip"
  "/home/aloeduca/ssl/.well-known.zip"
)
# Duplicate archive families to compare against each other
ARCHIVE_GLOBS=("alo-education-web-crm-final*.zip" "ALO-FULL-SOURCE*.zip" ".well-known*.zip")

# --- PROTECTED: refuse to touch these regardless of arguments -----------------
PROTECTED_DIRS=(
  "/root/ALO-LEARNING-JOURNEY"     # protected until GitHub source is verified
  "/root/alo-github-main-new"      # protected until GitHub source is verified
)
HARD_BLOCK_PATTERNS=(
  "public_html" "/etc/ssl" "/ssl/" "letsencrypt" "/.ssh" "/var/lib/mysql"
  "/var/lib/postgresql" "/var/www/html" "/proc" "/sys" "/dev" "/boot" "/etc"
)
HARD_BLOCK_SUFFIXES=(".env" ".env.save" ".env.production" ".env.local" ".db" ".sqlite" ".sqlite3" ".pem" ".key" ".crt" ".p12" ".pfx" "id_rsa" "authorized_keys")

have(){ command -v "$1" >/dev/null 2>&1; }
hr(){ printf '\n%s\n' "-------------------------------------------------------------------------------"; }
bytes_of(){ du -sb --apparent-size "$1" 2>/dev/null | cut -f1 || echo 0; }
human(){ numfmt --to=iec-i --suffix=B "${1:-0}" 2>/dev/null || echo "${1:-0}B"; }
devof(){ stat -c '%d' "$1" 2>/dev/null || echo "?"; }

# Collect the set of directories that are LIVE (docroots / service working dirs).
# Anything in this set is auto-blocked from quarantine.
declare -A LIVE_PATHS=()
collect_live_paths() {
  local p
  # Apache DocumentRoot
  for f in /etc/apache2/sites-enabled/* /etc/httpd/conf.d/*.conf; do
    [[ -f $f ]] || continue
    while read -r p; do [[ -n $p ]] && LIVE_PATHS["$p"]="apache:$f"; done \
      < <(grep -rhoiE '^[[:space:]]*DocumentRoot[[:space:]]+[^[:space:]]+' "$f" 2>/dev/null | awk '{print $2}' | tr -d '"')
  done
  # Nginx root
  if have nginx; then
    while read -r p; do [[ -n $p ]] && LIVE_PATHS["$p"]="nginx:nginx -T"; done \
      < <(nginx -T 2>/dev/null | grep -oE '^[[:space:]]*root[[:space:]]+[^;]+' | awk '{print $2}' | tr -d '";')
  fi
  for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [[ -f $f ]] || continue
    while read -r p; do [[ -n $p ]] && LIVE_PATHS["$p"]="nginx:$f"; done \
      < <(grep -rhoE '^[[:space:]]*root[[:space:]]+[^;]+' "$f" 2>/dev/null | awk '{print $2}' | tr -d '";')
  done
  # LiteSpeed docRoot
  for f in /usr/local/lsws/conf/httpd_config.conf /usr/local/lsws/conf/vhosts/*/vhconf.conf; do
    [[ -f $f ]] || continue
    while read -r p; do [[ -n $p ]] && LIVE_PATHS["$p"]="litespeed:$f"; done \
      < <(grep -rhoE 'docRoot[[:space:]]+[^[:space:]]+' "$f" 2>/dev/null | awk '{print $2}')
  done
  # systemd WorkingDirectory / ExecStart paths
  while read -r p; do [[ -n $p && -e $p ]] && LIVE_PATHS["$p"]="systemd-unit"; done \
    < <(grep -rhoE '^(WorkingDirectory|ExecStart)=[^[:space:]]+' /etc/systemd/system /lib/systemd/system 2>/dev/null \
        | sed -E 's/^(WorkingDirectory|ExecStart)=//; s#^/[^ ]*/(node|bun|php|python3|nginx|caddy)#/#' | awk '{print $1}')
  # PM2 script/cwd
  if have pm2; then
    while read -r p; do [[ -n $p ]] && LIVE_PATHS["$p"]="pm2"; done \
      < <(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s).forEach(p=>{const e=p.pm2_env||{};[e.pm_cwd,e.pm_exec_path].filter(Boolean).forEach(x=>console.log(x))})}catch(_){}})' 2>/dev/null)
  fi
  # cPanel / user public_html
  for p in /home/*/public_html; do [[ -d $p ]] && LIVE_PATHS["$p"]="cpanel-docroot"; done
  # running process cwds
  for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
    p=$(readlink "/proc/$pid/cwd" 2>/dev/null)
    [[ -n $p && $p != "/" ]] && LIVE_PATHS["$p"]="proc:$pid-cwd"
  done
}

is_hard_blocked() { # path -> reason on stdout, exit 0 if blocked
  local p="$1" pat base
  base="$(basename "$p")"
  for pat in "${HARD_BLOCK_PATTERNS[@]}"; do
    case "$p" in *"$pat"*) echo "matches hard-blocked pattern '$pat'"; return 0 ;; esac
  done
  for pat in "${HARD_BLOCK_SUFFIXES[@]}"; do
    [[ "$base" == *"$pat" ]] && { echo "is a secret/credential/database file ($pat)"; return 0; }
  done
  for d in "${PROTECTED_DIRS[@]}"; do
    [[ "$p" == "$d" || "$p" == "$d"/* ]] && { echo "PROTECTED directory pending GitHub source verification"; return 0; }
  done
  if [[ -n "${LIVE_PATHS[$p]:-}" ]]; then echo "is a LIVE document root / service working dir (${LIVE_PATHS[$p]})"; return 0; fi
  # also block if it is a PARENT of a live path
  if [[ ${#LIVE_PATHS[@]} -gt 0 ]]; then
    for lp in "${!LIVE_PATHS[@]}"; do
      [[ "$lp" == "$p"/* ]] && { echo "contains a LIVE path ($lp via ${LIVE_PATHS[$lp]})"; return 0; }
    done
  fi
  return 1
}

in_use_by_process() { # path -> exit 0 if a live process is inside it
  local p="$1" pid cwd exe
  for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null); exe=$(readlink "/proc/$pid/exe" 2>/dev/null)
    case "$cwd" in "$p"|"$p"/*) echo "PID $pid cwd=$cwd"; return 0 ;; esac
    case "$exe" in "$p"|"$p"/*) echo "PID $pid exe=$exe"; return 0 ;; esac
  done
  if have lsof; then
    lsof +D "$p" 2>/dev/null | awk 'NR>1{print "open handle: "$1" pid="$2" "$NF; found=1} END{exit !found}' && return 0
  fi
  return 1
}

referenced_by_config() { # path -> exit 0 if any config references it
  local p="$1" esc hits
  esc="$(printf '%s' "$p" | sed 's/[][\.*^$/]/\\&/g')"
  hits=$(grep -rilE "$esc" /etc/apache2 /etc/nginx /etc/httpd /usr/local/lsws/conf /etc/caddy \
         /etc/systemd/system /lib/systemd/system /etc/cron* /var/spool/cron 2>/dev/null | head -5)
  [[ -n $hits ]] && { echo "$hits"; return 0; }
  return 1
}

# =============================================================================
echo "ALO CLEANUP — MODE: $MODE   (dry-run changes NOTHING)"
echo "Quarantine target : $QUAR_DIR"
echo "Proposal file     : $PROPOSAL"
[[ $MODE == execute ]] && echo "*** EXECUTE MODE: items will be MOVED (not deleted). Restore = mv back. ***"

collect_live_paths
echo; echo "Detected LIVE paths (auto-protected):"
if [[ ${#LIVE_PATHS[@]} -gt 0 ]]; then
  for lp in "${!LIVE_PATHS[@]}"; do printf '  %-50s <- %s\n' "$lp" "${LIVE_PATHS[$lp]}"; done
fi
[[ ${#LIVE_PATHS[@]} -eq 0 ]] && echo "  (none detected — this is suspicious on a production box; verify section 6 of the audit)"

# --- build checksum map for duplicate archives --------------------------------
declare -A SHA=()
if [[ $DO_CHECKSUMS -eq 1 ]]; then
  echo; echo "Computing SHA-256 for archives (this reads multi-GB files; be patient)..."
  for g in "${ARCHIVE_GLOBS[@]}"; do
    while IFS= read -r -d '' f; do
      h=$(sha256sum "$f" 2>/dev/null | awk '{print $1}')
      [[ -n $h ]] && { SHA["$f"]="$h"; printf '  %s  %s\n' "${h:0:16}…" "$f"; }
    done < <(find /root /home /var /opt /srv /tmp -xdev -type f -iname "$g" -print0 2>/dev/null)
  done
  # ALSO hash every candidate that is a file, even if it sits outside the scan
  # roots above. Without this a candidate would go unhashed and fall through to a
  # plain CANDIDATE verdict - which is how an only-copy gets moved by mistake.
  for _cc in "${CANDIDATES[@]}"; do
    [[ -f $_cc && -z "${SHA[$_cc]:-}" ]] || continue
    _ch=$(sha256sum "$_cc" 2>/dev/null | awk '{print $1}')
    [[ -n $_ch ]] && { SHA["$_cc"]="$_ch"; printf '  %s…  %s (candidate)\n' "${_ch:0:16}" "$_cc"; }
  done
fi

# --- designate ONE guaranteed survivor per identical-content group -------------
# BUG THIS PREVENTS: if two byte-identical copies each see the other as a
# "surviving twin", BOTH get quarantined and the data is gone. So for every
# SHA-256 group we elect exactly one KEEPER that must never move, and only the
# non-keeper members are eligible. Keeper preference order:
#   1. a member that is hard-blocked / live (it cannot move anyway, so it is a
#      guaranteed survivor - e.g. a copy inside public_html or an SSL dir),
#   2. then the shortest path, 3. then lexically smallest (deterministic).
declare -A GROUP_SIZE=() KEEPER_OF=()
if [[ ${#SHA[@]} -gt 0 ]]; then
  declare -A _members=()
  _gf=""; _gh=""; _gm=""; _gkeeper=""
  for _gf in "${!SHA[@]}"; do _members["${SHA[$_gf]}"]+="$_gf"$'\n'; done
  for _gh in "${!_members[@]}"; do
    mapfile -t _gmem < <(printf '%s' "${_members[$_gh]}" | sed '/^$/d')
    GROUP_SIZE["$_gh"]=${#_gmem[@]}
    (( ${#_gmem[@]} < 2 )) && continue
    _gkeeper=""
    for _gm in "${_gmem[@]}"; do                   # pass 1: a blocked/live member
      if is_hard_blocked "$_gm" >/dev/null 2>&1; then _gkeeper="$_gm"; break; fi
    done
    if [[ -z $_gkeeper ]]; then                    # pass 2: shortest, then lexical
      _gkeeper=$(printf '%s\n' "${_gmem[@]}" | awk '{print length($0)"\t"$0}' | sort -n -k1,1 -k2,2 | head -1 | cut -f2-)
    fi
    for _gm in "${_gmem[@]}"; do [[ "$_gm" != "$_gkeeper" ]] && KEEPER_OF["$_gm"]="$_gkeeper"; done
    printf '  identical group %s...  size=%d  KEEPER=%s\n' "${_gh:0:16}" "${#_gmem[@]}" "$_gkeeper"
    for _gm in "${_gmem[@]}"; do [[ "$_gm" != "$_gkeeper" ]] && printf '      removable duplicate: %s\n' "$_gm"; done
  done
fi

# --- evaluate each candidate --------------------------------------------------
TOTAL_RECLAIM=0
ROWS=()
evaluate() {
  local p="$1"
  [[ -e $p ]] || { ROWS+=("$p|ABSENT|0|does not exist on this host|n/a|NO ACTION — remove from candidate list"); return; }
  if [[ -n $ONLY_PATH && "$p" != "$ONLY_PATH" ]]; then ROWS+=("$p|SKIPPED|0|filtered out by --only|n/a|NO ACTION"); return; fi

  local sz reason verdict action blocked inuse refs
  sz=$(bytes_of "$p")
  if blocked=$(is_hard_blocked "$p"); then
    ROWS+=("$p|BLOCKED|$sz|$blocked|n/a|NO ACTION — protected by policy"); return
  fi
  if inuse=$(in_use_by_process "$p"); then
    ROWS+=("$p|LIVE-IN-USE|$sz|process active inside it: $inuse|n/a|NO ACTION — in use by a running service"); return
  fi
  if refs=$(referenced_by_config "$p"); then
    ROWS+=("$p|LIVE-REFERENCED|$sz|referenced by config: $(echo "$refs" | tr '\n' ' ')|n/a|NO ACTION — wired into web/service config"); return
  fi

  # Not live. Now decide whether a verified independent copy exists.
  local dupinfo="no verified duplicate"
  verdict="CANDIDATE"
  action="QUARANTINE (move, reversible)"
  if [[ -f $p && $DO_CHECKSUMS -eq 1 && -n "${SHA[$p]:-}" ]]; then
    local h="${SHA[$p]}"
    local gsize="${GROUP_SIZE[$h]:-1}"   # separate stmt: bash expands all words in
                                          # one `local` before assigning, so using $h
                                          # on the same line reads a STALE value
    if (( gsize < 2 )); then
      # Unique content. A similar name or an equal size is NOT proof of duplication.
      ROWS+=("$p|KEEP-UNIQUE|$sz|SHA-256 ${h:0:16}... is unique - no byte-identical copy exists anywhere scanned|n/a|NO ACTION - this is the only copy and may be the only recoverable backup")
      return
    fi
    if [[ -z "${KEEPER_OF[$p]:-}" ]]; then
      ROWS+=("$p|KEEPER|$sz|elected survivor of $gsize byte-identical copies (SHA-256 ${h:0:16}...) - must remain in place|n/a|NO ACTION - required so the duplicates stay recoverable")
      return
    fi
    local keeper="${KEEPER_OF[$p]}"
    if [[ ! -e $keeper ]]; then
      ROWS+=("$p|KEEP-ORPHANED|$sz|designated survivor '$keeper' no longer exists|n/a|NO ACTION - refusing to remove the last reachable copy")
      return
    fi
    dupinfo="byte-identical to KEEPER $keeper (SHA-256 ${h:0:16}..., group of $gsize); the keeper stays in place"
  elif [[ -f $p && $DO_CHECKSUMS -eq 0 ]]; then
    ROWS+=("$p|NEEDS-EVIDENCE|$sz|file/archive, not yet checksummed|unknown|NO ACTION YET — re-run with --checksums to prove/disprove duplication before moving"); return
  elif [[ -f $p ]]; then
    # --checksums was requested but this file produced no hash (unreadable, or
    # outside every scan root). Refuse rather than fall through to CANDIDATE.
    ROWS+=("$p|NEEDS-EVIDENCE|$sz|--checksums was set but no SHA-256 was obtained (unreadable, or outside the scan roots)|unknown|NO ACTION — fix readability or add the path to ARCHIVE_GLOBS/scan roots, then re-run"); return
  fi

  # Directories: require that they are not the only copy of an app
  if [[ -d $p ]]; then
    local hasenv="" hasgit=""
    [[ -f "$p/.env" || -f "$p/.env.save" ]] && hasenv="contains .env SECRETS (do NOT commit to git; copy to a root-only 600 secret store first)"
    [[ -d "$p/.git" ]] && hasgit="has .git history"
    dupinfo="directory, not referenced by any service or vhost; $hasgit $hasenv"
    [[ -n $hasenv ]] && verdict="CANDIDATE-WITH-SECRETS"
  fi

  TOTAL_RECLAIM=$((TOTAL_RECLAIM + sz))
  ROWS+=("$p|$verdict|$sz|$dupinfo|$([[ $MODE == execute ]] && echo moved || echo would-move)|$action")
}

for c in "${CANDIDATES[@]}"; do evaluate "$c"; done
# also catch duplicate archive families wherever they live
if [[ $DO_CHECKSUMS -eq 1 ]]; then
  if [[ ${#SHA[@]} -gt 0 ]]; then
    for f in "${!SHA[@]}"; do
      already=0; for c in "${CANDIDATES[@]}"; do [[ "$c" == "$f" ]] && already=1; done
      [[ $already -eq 0 ]] && evaluate "$f"
    done
  fi
fi

# --- write the proposal -------------------------------------------------------
{
  echo "# ALO Cleanup Proposal — $TS"
  echo
  echo "- Mode: **$MODE**"
  echo "- Quarantine directory: \`$QUAR_DIR\`"
  echo "- Checksums: $([[ $DO_CHECKSUMS -eq 1 ]] && echo enabled || echo 'DISABLED (archive duplication NOT proven)')"
  echo "- Policy: items are **moved**, never deleted. Permanent deletion is a separate manual step."
  echo
  echo "## Decision table"
  echo
  echo "| Path | Verdict | Size | Evidence | Action |"
  echo "|---|---|---|---|---|"
  for r in ${ROWS[@]+"${ROWS[@]}"}; do
    IFS='|' read -r p v sz ev _ act <<<"$r"
    echo "| \`$p\` | $v | $(human "$sz") | $ev | $act |"
  done
  echo
  echo "## Expected disk space recovered (quarantined, still on disk until purge)"
  echo
  echo "**$(human "$TOTAL_RECLAIM")** — note: quarantine does NOT free space until"
  echo "\`purge-quarantine.sh\` runs after the site has been verified healthy."
  echo
  echo "## Detected live paths (never touched)"
  echo
  if [[ ${#LIVE_PATHS[@]} -gt 0 ]]; then
    for lp in "${!LIVE_PATHS[@]}"; do echo "- \`$lp\`  ← ${LIVE_PATHS[$lp]}"; done
  else
    echo "- (none detected)"
  fi
  echo
  echo "## Restore procedure"
  echo
  echo "\`\`\`bash"
  echo "# every move is logged in $MANIFEST as: original_path<TAB>quarantine_path<TAB>sha256<TAB>bytes"
  echo "bash $QUAR_DIR/restore.sh              # restore everything moved in this run"
  echo "bash $QUAR_DIR/restore.sh '/root/alo-live'   # restore one item"
  echo "\`\`\`"
} > "$PROPOSAL"

hr
column -t -s'|' <<<"$(printf '%s\n' ${ROWS[@]+"${ROWS[@]}"} | awk -F'|' '{printf "%s|%s|%s|%s\n", $1, $2, $3, $6}')" 2>/dev/null \
  || printf '%s\n' ${ROWS[@]+"${ROWS[@]}"}
hr
echo "Expected reclaim: $(human "$TOTAL_RECLAIM")"
echo "Proposal written : $PROPOSAL"

# --- execute ------------------------------------------------------------------
if [[ $MODE != execute ]]; then
  echo; echo "DRY RUN COMPLETE — nothing was moved."
  echo "Re-run with --execute after reviewing $PROPOSAL."
  exit 0
fi

MOVABLE=()
for r in ${ROWS[@]+"${ROWS[@]}"}; do
  IFS='|' read -r p v sz ev _ act <<<"$r"
  case "$v" in CANDIDATE|CANDIDATE-UNVERIFIED|CANDIDATE-WITH-SECRETS) MOVABLE+=("$p") ;; esac
done
if [[ ${#MOVABLE[@]} -eq 0 ]]; then echo "Nothing qualified for quarantine. Exiting without changes."; exit 0; fi

mkdir -p "$QUAR_DIR" || { echo "FATAL: cannot create quarantine dir $QUAR_DIR"; exit 1; }
chmod 700 "$QUAR_ROOT" "$QUAR_DIR" 2>/dev/null
printf 'original_path\tquarantine_path\tsha256\tbytes\tmtime_utc\n' > "$MANIFEST"
QDEV=$(devof "$QUAR_DIR")

for p in ${MOVABLE[@]+"${MOVABLE[@]}"}; do
  echo; hr; echo "QUARANTINING: $p"
  # same-filesystem guard: a cross-device mv is really copy+unlink (slow, risky)
  if [[ "$(devof "$p")" != "$QDEV" ]]; then
    echo "  SKIP: $p is on a different filesystem than $QUAR_DIR."
    echo "        A cross-device move would copy then unlink — not atomic, not safe."
    echo "        Set ALO_QUARANTINE_ROOT to a path on the same device and re-run."
    continue
  fi
  # last-chance live re-check (state may have changed since evaluation)
  if blocked=$(is_hard_blocked "$p"); then echo "  SKIP (blocked at execute time): $blocked"; continue; fi
  if inuse=$(in_use_by_process "$p"); then echo "  SKIP (in use at execute time): $inuse"; continue; fi
  # last-chance duplicate re-check: the elected survivor must still exist NOW
  if [[ -n "${KEEPER_OF[$p]:-}" && ! -e "${KEEPER_OF[$p]}" ]]; then
    echo "  SKIP: designated survivor '${KEEPER_OF[$p]}' is gone - refusing to remove the last copy."
    continue
  fi
  if [[ -f $p && $DO_CHECKSUMS -eq 1 && -n "${SHA[$p]:-}" && "${GROUP_SIZE[${SHA[$p]}]:-1}" -lt 2 ]]; then
    echo "  SKIP: content is unique (no byte-identical survivor) - refusing to quarantine the only copy."
    continue
  fi

  rel="${p#/}"; dest="$QUAR_DIR/$rel"
  mkdir -p "$(dirname "$dest")" || { echo "  SKIP: cannot create $(dirname "$dest")"; continue; }
  # Fingerprint what is being moved, so the manifest is an audit trail.
  # Files: SHA-256 (if computed). Directories: file count + total bytes, since
  # hashing a whole tree here would double the I/O of the operation itself.
  if [[ -f $p && $DO_CHECKSUMS -eq 1 && -n "${SHA[$p]:-}" ]]; then
    h="${SHA[$p]}"
  elif [[ -f $p ]]; then
    h="file-not-checksummed"
  else
    h="dir:$(find "$p" -type f 2>/dev/null | wc -l)files:$(du -sb "$p" 2>/dev/null | cut -f1)bytes"
  fi
  if mv -v -- "$p" "$dest" 2>&1 | sed 's/^/  /'; then
    printf '%s\t%s\t%s\t%s\t%s\n' "$p" "$dest" "$h" "$(bytes_of "$dest")" "$(date -u +%FT%TZ)" >> "$MANIFEST"
    echo "  MOVED OK -> $dest"
  else
    echo "  MOVE FAILED — leaving $p untouched."
  fi
done

# --- generate restore script --------------------------------------------------
cat > "$QUAR_DIR/restore.sh" <<'RESTORE'
#!/usr/bin/env bash
# Restore items quarantined by cleanup-quarantine.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAN="$HERE/manifest.tsv"
FILTER="${1:-}"
[[ -f $MAN ]] || { echo "no manifest at $MAN"; exit 1; }
tail -n +2 "$MAN" | while IFS=$'\t' read -r orig quar sha bytes mtime; do
  [[ -n $FILTER && "$orig" != "$FILTER" ]] && continue
  if [[ ! -e $quar ]]; then echo "MISSING in quarantine: $quar"; continue; fi
  if [[ -e $orig ]]; then echo "REFUSING: $orig already exists again — resolve manually"; continue; fi
  mkdir -p "$(dirname "$orig")"
  mv -v -- "$quar" "$orig" && echo "RESTORED: $orig"
done
RESTORE
chmod +x "$QUAR_DIR/restore.sh"
echo; echo "Restore script written: $QUAR_DIR/restore.sh"
echo "Manifest: $MANIFEST"

# --- post-move verification ---------------------------------------------------
hr; echo "POST-MOVE VERIFICATION (run these and confirm before any purge)"; hr
echo "  df -h /root /home /var"
df -h /root /home /var 2>/dev/null | sed 's/^/    /'
echo
echo "  HTTP checks:"
for u in "http://127.0.0.1:3017/api/health" "http://127.0.0.1/" "https://learn.aloeducation.com/" "https://aloeducation.com/"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 -k "$u" 2>/dev/null)
  printf '    %-45s HTTP %s\n' "$u" "${code:-ERR}"
done
echo
echo "  Services still running:"
if have pm2; then pm2 ls 2>/dev/null | head -12 | sed 's/^/    /'; fi
if have systemctl; then systemctl is-active nginx apache2 caddy mysql mariadb 2>/dev/null | sed 's/^/    /'; fi
echo
echo "If ANY check above fails, roll back immediately:"
echo "    bash $QUAR_DIR/restore.sh"
echo
echo "Quarantined $(human "$TOTAL_RECLAIM") (expected). Space is reclaimed ONLY after purge."
echo "Do NOT purge until the site, CRM, login and API routes have been verified healthy."
