# 04 — Cleanup plan: classification method and per-candidate evidence gaps

**Nothing has been moved, quarantined, or deleted.** No sizes below are asserted
as current — your earlier figures (3.3 GB, 3.1 GB, 1.2 GB) are treated as
*unverified prior observations* and must be re-measured, exactly as you
instructed.

This document explains how each candidate gets classified, what evidence is
missing for each, and what the tooling will and will not do.

---

## 1. Classification model

Every candidate must be assigned **exactly one** role, from evidence — never from
its name or size:

| Role | Meaning | Default action |
|---|---|---|
| **LIVE** | Serves traffic now: a vhost `DocumentRoot`/`root`, a systemd `WorkingDirectory`, a PM2 `pm_cwd`/`pm_exec_path`, or a running process's cwd | **NEVER TOUCH** |
| **RELEASE** | A deployed build kept for rollback (has `.next/standalone`, `node_modules`, a `.git` at a known commit) | **NEVER TOUCH** while it is the rollback handle |
| **DATABASE** | Contains `.db`/`.sqlite*`, or is the target of `DATABASE_URL` | **NEVER TOUCH** |
| **SSL** | Certs, keys, ACME/`.well-known`, anything under an `ssl` path | **NEVER TOUCH** |
| **SECRET** | `.env`, `.env.save`, private keys, credential stores | **NEVER TOUCH**; never move into a world-readable quarantine |
| **USER CONTENT** | `public_html`, uploads, media, customer data | **NEVER TOUCH** |
| **ONLY BACKUP** | The sole recoverable copy of something | **NEVER TOUCH** until an independent copy is verified |
| **ARCHIVE-DUPLICATE** | A file proven byte-identical (SHA-256) to another copy that survives outside quarantine | Quarantine candidate |
| **ABANDONED** | Not referenced by any config, not in use by any process, superseded, and not the only backup | Quarantine candidate |
| **UNKNOWN** | Evidence insufficient | **LEAVE UNTOUCHED and say what is missing** |

Only the last three can ever reach quarantine. `cleanup-quarantine.sh`
implements this with a hard-blocked list evaluated **twice** — once during
evaluation and again immediately before each move, in case state changed.

---

## 2. The four evidence tests applied to every candidate

The script gathers all four automatically:

**T1 — Is it wired into anything?**
```bash
grep -rilE '<escaped-path>' /etc/apache2 /etc/nginx /etc/httpd \
  /usr/local/lsws/conf /etc/caddy /etc/systemd/system /lib/systemd/system \
  /etc/cron* /var/spool/cron
```
Any hit ⇒ LIVE-REFERENCED ⇒ **no action**. This is the test that prevents
deleting a docroot because its name looks old.

**T2 — Is a process inside it right now?**
Reads `/proc/<pid>/cwd` and `/proc/<pid>/exe` for every PID, plus `lsof +D`.
Any hit ⇒ LIVE-IN-USE ⇒ **no action**. Catches apps started manually, outside
PM2/systemd.

**T3 — Is there a byte-identical surviving twin?**
SHA-256, and the twin must itself be non-blocked and outside the quarantine
root. **Name and size equality are explicitly not accepted as proof.**
No proven twin for an archive ⇒ `NEEDS-EVIDENCE` / `KEEP-UNVERIFIED` ⇒
**no action** unless you pass `--allow-unverified`, which is logged loudly in the
proposal as an accepted risk.

**T4 — Does it contain secrets or a database?**
Presence of `.env`, `.env.save`, `*.db`, `*.sqlite*`, `*.pem`, `*.key`, `*.crt`
⇒ suffix hard-block for files; for directories ⇒ verdict
`CANDIDATE-WITH-SECRETS` and a warning that secrets must be copied to a
root-only `0600` store *before* the directory is quarantined, and must never be
added to Git.

Also recorded per candidate: `size`, `mtime`, **`atime`**, owner/mode, `has .git`,
`has node_modules`. `atime` is a useful signal — a live docroot is read
constantly, an abandoned copy is not — but it is **advisory only**: if the
filesystem is mounted `noatime`/`relatime` it proves nothing, so the script never
acts on `atime` alone.

---

## 3. Per-candidate assessment

### Directories

| Candidate | Prior hypothesis | Verifiable classification path | Missing evidence |
|---|---|---|---|
| `/root/alo-live` | Name suggests a former live deployment | T1+T2 decide. If a vhost or PM2 points here it is **LIVE** regardless of the word "alo-live". Otherwise check for `.next/standalone` + `node_modules` ⇒ **RELEASE** (rollback handle) ⇒ keep. Only if it is an older build *and* a newer verified release exists ⇒ ARCHIVE/ABANDONED | Its `.git` commit vs the canonical commit; whether any vhost/PM2/systemd references it; whether it is the only rollback target |
| `/root/alo-live-new` | Name suggests a newer attempt | Same as above. **"new" in a name is not evidence of currency** — compare `.git` HEAD and build mtime, not the label | Same |
| `/root/alo-github-main` | Likely an earlier ZIP extraction of some repo's `main` (`…-main.zip` naming) | If **no `.git`** ⇒ it is an upload, cannot pull/push, and has no commit to compare. Then only a checksum/manifest comparison against `/root/alo-github-main-new` can show whether it is superseded | Whether it has `.git`; its remote/commit if so; whether `alo-github-main-new` fully supersedes it |
| `/var/www/alo-education` | Classic Apache/Nginx docroot location | **Highest-risk candidate.** T1 is decisive: any `DocumentRoot`/`root` match ⇒ LIVE ⇒ never touch. Also check `atime` and access logs | Vhost config; whether the public site is served from here |
| `/var/www/alo-education_vps` | Variant of the above, possibly a staging copy | Same tests. A `_vps` suffix often means "the copy that was uploaded to the VPS" — but that must be proven, not assumed | Same |
| `/home/aloeduca/alo-education` | Copy inside a cPanel-style home | T1 (cPanel vhosts often point into `public_html`, not here). Check for `.git`, `node_modules`, build output | Whether it is a build, a source drop, or a backup |
| **`/home/aloeduca/public_html`** | **Live cPanel document root** | **HARD-BLOCKED BY POLICY.** Matches `public_html` in the hard-block list and is auto-added to `LIVE_PATHS` for every `/home/*/public_html`. **The script will refuse to quarantine it even if you name it explicitly.** This also protects any SSL/`.well-known` inside it | None needed — it is never a candidate |
| `/home/aloedu/learn-app` | **The path the repo's CI actually deploys to** (`.github/workflows/deploy.yml`, `DEPLOYMENT.md`) | Added to the audit's scan list. If it exists it is almost certainly **LIVE** for the Learning Journey app (CI `cd`s into it and `git pull`s). Must be protected, not cleaned | Whether it exists; its `.git` HEAD vs `origin/main`; whether it is PM2's cwd |

### Archives

| Candidate | Notes | Decision rule |
|---|---|---|
| `/root/ALO-FULL-SOURCE 2.zip` (~3.3 GB prior) | **You explicitly forbade deleting this merely because another copy exists**, and the script enforces that: it is only a candidate when a **SHA-256-identical twin survives outside quarantine**. If `/home/aloeduca/ALO-FULL-SOURCE 2.zip` differs by even one byte, both are kept and the difference is reported | Requires `--checksums`. Hashing 3.3 GB is slow; run under `ionice -c3 nice -n19` |
| `/home/aloeduca/ALO-FULL-SOURCE 2.zip` | Presumed duplicate of the above. The ` 2` in both filenames is the classic browser "duplicate download" suffix, which is *suggestive* but **proves nothing** — the two downloads may be different builds | Same rule. Also: whichever survives should be copied off-server before either is quarantined, if it is the only full-source archive |
| **`/home/aloeduca/ssl/.well-known.zip`** (~3.1 GB prior) | ⚠ **Highest caution of all the archives.** It lives under an `ssl/` path, which is hard-blocked by policy. `.well-known` is the ACME HTTP-01 challenge directory used by Let's Encrypt/cPanel AutoSSL. A 3.1 GB ZIP *inside* `ssl/` is anomalous — plausible readings: (a) a misplaced full-site backup dropped into the wrong directory, (b) an archive of a docroot that includes `.well-known`, (c) something SSL-adjacent that a renewal depends on. **Deleting or moving it could break certificate renewal**, and if it is the only copy of a 3.1 GB site archive, it is also an ONLY-BACKUP | **Left untouched by default.** Before any action: list its contents *without extracting* (`unzip -l`), confirm nothing references it (T1), confirm cert renewal does not depend on the path, and confirm an independent copy exists. If it turns out to be a site backup, it should be **moved to a proper backup location, not quarantined** |
| Duplicate `alo-education-web-crm-final.zip` (multiple ~1.2 GB prior) | The `-final` suffix plus multiple copies is the classic pattern of repeated manual exports. But this is likely the **CRM source**, and per your brief the CRM is live. If the CRM's running code exists only as an extracted directory plus these ZIPs, one ZIP may be the **only** rollback for the CRM | Group all matching files by SHA-256 (`ARCHIVE_GLOBS` covers `alo-education-web-crm-final*.zip`). Keep one verified copy per distinct checksum; quarantine only proven-identical extras. **If several distinct checksums exist, every one is kept** — they are different builds, not duplicates |

### Also worth measuring (not on your list, but usually the biggest win)

The audit script reports these separately, because they are frequently larger
than any ZIP and are **safely regenerable**:

- **`node_modules/` in abandoned directories** — the script lists every
  `node_modules` with its size. In an abandoned copy this is pure reclaim, and
  it is regenerable with `bun install`. In a **LIVE** directory it must stay.
- **`.next/` build caches** in superseded releases.
- **Old release directories** once the symlink pattern in
  `03-DEPLOY-ROLLBACK-RUNBOOK.md` §1 is adopted (keep the last 3–5).
- **PM2 logs / journald / Apache-Nginx access logs** — measured, reported, and
  handled by log rotation, not by this cleanup.
- **Docker images/volumes** if Docker turns out to be installed (`docker system df`).

These are reported for your decision; the script does **not** auto-target them.

---

## 4. Why quarantine rather than delete

```
/root/.alo-quarantine/                 chmod 700
└── 20260914-153000Z/
    ├── manifest.tsv                   original<TAB>quarantine<TAB>sha256<TAB>bytes<TAB>mtime
    ├── restore.sh                     generated automatically
    └── root/alo-live/…                original path structure preserved
```

1. **`mv` within one filesystem is atomic and instant** — no long copy window
   during which a half-moved directory could break a service. The script
   **verifies the source and quarantine are on the same device** (`stat -c %d`)
   and **refuses** to move across devices, because a cross-device `mv` is really
   copy-then-unlink: slow, non-atomic, and it consumes *more* space before it
   frees any.
2. **Recovery is one command**: `bash <quarantine>/restore.sh` (all items) or
   `restore.sh '/root/alo-live'` (one item). `restore.sh` **refuses** if the
   original path has reappeared, so it cannot clobber something recreated since.
3. **The manifest carries SHA-256**, so you can prove after the fact that what
   you quarantined is what you measured.
4. **Disk space is not reclaimed until purge.** This is deliberate and it is the
   honest trade-off: quarantine buys *certainty*, not bytes. The proposal prints
   both numbers — "quarantined" vs "reclaimed after purge" — so you are never
   misled about how much space you actually got back.
5. **Permanent deletion is a separate, later, manual step**, run only after the
   site, CRM, login, API routes and cert renewal have all been verified healthy
   and a reasonable soak period has passed. `cleanup-quarantine.sh` contains no
   `rm` at all.

**Space planning:** quarantine needs *no* extra space for same-device moves
(only directory entries change). But **purge is irreversible**, so before purging,
anything that is the only copy of a full source archive should already exist
off-server. If `/root` is near full, set `ALO_QUARANTINE_ROOT` to a path on the
**same device** with room — the script tells you each path's device so you can
check.

---

## 5. Prohibited commands (enforced, not just advised)

Your brief lists these, and I agree with all of them. They appear nowhere in the
tooling:

- `rm -rf /root/*`, `rm -rf /var/www/*`, `rm -rf /home/aloeduca/*`
- Wildcard ZIP deletion (`rm *.zip`, `find … -name '*.zip' -delete`)
- Deleting a directory because of its **name** ("alo-live", "old", "backup",
  "_vps", "2") or because of its **size**
- `git reset --hard`, `git clean -fd`, force-push, overwriting a working tree
- Deleting `/root/ALO-FULL-SOURCE 2.zip` because another copy exists, without
  checksum + recoverability proof
- Any destructive DB migration, `prisma db push --accept-data-loss`, or `db reset`
- Touching `public_html`, live docroots, databases, SSL dirs, secrets, or the
  only recoverable backup

`cleanup-quarantine.sh` has **no `rm` invocation**. Its only mutating operation
is `mv` into the quarantine tree, guarded by the same-filesystem check and the
re-checked hard-block list.

---

## 6. Execution order

```
1. vps-readonly-audit.sh                    → facts (read-only, nothing changes)
2. vps-readonly-audit.sh --checksums        → prove/disprove archive duplication
3. cleanup-quarantine.sh --checksums        → DRY RUN, writes the proposal only
4. YOU review cleanup-proposal-<ts>.md      → human decision on every row
5. §2 backup gate (03-DEPLOY-ROLLBACK-RUNBOOK.md) → verified restorable backup
6. cleanup-quarantine.sh --checksums --execute     → moves only approved items
7. Re-run audit §5–§8 + the 03 §5 checks    → prove site/CRM/API/certs healthy
8. Soak (days), then purge separately       → only now is space reclaimed
```

Step 4 is a human step by design. Step 8 is a different script, run later, on
purpose.

If a candidate cannot be confidently classified at step 4, it stays exactly
where it is, and the proposal records **what evidence is missing** — which is
what your brief asks for.
