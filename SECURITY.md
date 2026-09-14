# ALO Learning Journey — Security

## Authentication
- Status: NOT_IMPLEMENTED (no auth middleware)
- Production requires: NextAuth.js + RBAC middleware

## Secrets Management
- `.env` is in `.gitignore` — never committed
- `.env.example` contains placeholder values only
- GitHub Actions secrets used for VPS deployment
- No credential-shaped strings in source code (verified by pattern scan across
  all tracked files: no `AKIA…`, `ghp_…`, `github_pat_…`, `xox…`, PEM private
  keys, or DSNs with embedded passwords)

## Application backups are NOT encrypted
`storage/backups/*.alo.bak` is a **raw SQLite database file** XOR-obfuscated with
the key `"alo-backup-2024"`, which is **hardcoded in
`src/app/api/backups/route.ts`** next to the comment *"not real crypto — marker
only"*. The manifest's `"encrypted": true` field is **false**. Anyone with the
file and this public source can decode it in one line.

Consequences:
- Never commit a `.alo.bak` to Git. `storage/backups/` is now gitignored, and the
  one file that had been committed (266 KB, 383 rows) has been removed from the
  working tree. **It remains in Git history** until history is rewritten — see
  `audit/05-EXPOSURE-REMEDIATION.md`.
- Keep backups off the web root, on a `0700` directory, and ideally off-server.
- Replace XOR with real crypto (AES-256-GCM via `crypto.scryptSync` +
  `createCipheriv`, key from an env var) before relying on backups at all.

### What the exposed database did and did not contain
Verified by decoding the committed artefact and inspecting it column by column
(values were never printed):

- **No credentials.** No model in `prisma/schema.prisma` has a token, secret,
  password, or API-key column. `SocialConnection` holds only `id, platform,
  accountName, handle, status, scopesJson, tokenExpiry, lastSyncAt, createdAt,
  updatedAt` — and `scopesJson` was **NULL in all 11 rows**. The only
  token-named field anywhere in the 27-model schema is `tokenExpiry DateTime?`,
  a timestamp. **No OAuth token rotation is required.**
- **But real business data was public:** 383 rows including `AnalyticsSnapshot`
  (315), `AuditLog` (13), `ApprovalItem` (11), `CommentInbox` (8),
  `ContentPackage` (7), `ContentIdea` (4), `RagDocument` (4), `PublishedPost`
  (3), `TelegramCommand` (3), `Notification` (3), `Company` (1).
- That snapshot is also **stale and not a valid restore point**: 15 tables
  against the current 27 models, `createdAt` 2026-08-09 with `retentionDays: 14`.

## Known Limitations
- **No authentication/RBAC — all 39 API routes are open.** Includes
  `DELETE /api/backups`, which `fs.unlink`s backup files, so an anonymous
  request can destroy backups. Also `api/seed`, `api/settings`, `api/telegram`,
  `api/family-studio`, `api/video/*`, `api/images/generate`, `api/notifications`.
- No CSRF protection
- No rate limiting
- Production deployment requires auth middleware — or a proxy-level allowlist /
  VPN — **before** this is reachable on a public interface.
