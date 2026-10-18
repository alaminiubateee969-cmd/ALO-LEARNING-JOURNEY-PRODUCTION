# ALO Human Avatar — API Documentation

## Base URL
`https://your-domain/api`

## Authentication
All protected endpoints require a NextAuth JWT session cookie. In dev mode (no `NEXTAUTH_SECRET`), pass-through with `x-alo-auth: dev-fallback` header. In production, unauthenticated → 401.

---

## Human Avatars

### `GET /api/human-avatars`
List owner's avatars + presets + stats.

### `POST /api/human-avatars`
**Actions:**
- `seed_presets` — create all 6 preset avatars
- `create` (with `presetId` or custom fields) — create + optional portrait gen
- `generate_portrait` — regen portrait for existing avatar
- `delete` — delete avatar + cascade videos + cleanup files

### `DELETE /api/human-avatars`
Body: `{ "id": "<avatar-id>" }` → deletes avatar + videos + files.

---

## Avatar Video

### `GET /api/avatar-video`
List owner's videos. Optional `?avatarId=<id>` filter.

### `POST /api/avatar-video`
Generate a full avatar video.

**Request:**
```json
{
  "avatarId": "<id>",
  "prompt": "বাচ্চাদের স্ক্রিন টাইম কমানোর উপায়",
  "targetDuration": 60,
  "quality": "standard"
}
```

**Validation:**
- `prompt`: required, non-whitespace, max 2000 chars
- `targetDuration`: integer 30–3600
- `quality`: `standard` | `hd` | `cinematic`

**Rate limit:** 3 requests / 10 min / owner. 1 concurrent / owner.

**Response 200:**
```json
{
  "ok": true,
  "video": { "id":"...", "status":"completed", "actualDuration":81.32, ... },
  "title": "...",
  "scenes": [...],
  "lipSyncUsed": false,
  "lipSyncReason": "not_configured",
  "hasAudio": true,
  "hasVideo": true
}
```

### `DELETE /api/avatar-video`
Body: `{ "id": "<video-id>" }` → deletes record + 9 files (MP4, thumbnail, scene images, audio).

### `GET /api/avatar-video/file?id=<video-id>`
Authenticated owner-scoped media streaming (HTTP range support).

---

## Recovery Sweep

### `GET /api/recovery/sweep`
Dry-run preview of stuck jobs.

### `POST /api/recovery/sweep?timeoutMinutes=10`
Marks non-terminal jobs older than timeout as `failed`. Idempotent. Cron-protectable via `x-cron-secret` header.

---

## Error Responses

| Status | When |
|--------|------|
| 400 | malformed/invalid client input |
| 401 | unauthenticated |
| 404 | not found (ownership-scoped) |
| 409 | concurrent generation conflict |
| 429 | rate-limited |
| 500 | server error (with `jobId` for correlation) |

## Lip-Sync States

The `lipSyncReason` field honestly reports:
- `success` — lip-sync applied + verified (only when `lipSyncUsed=true`)
- `not_configured` — `LIPSYNC_SERVICE_URL` env unset (talking-portrait mode)
- `http_error` — provider returned non-2xx
- `invalid_output` — provider returned non-video or stream-missing output
- `timeout` — provider exceeded `LIPSYNC_TIMEOUT_MS`
- `provider_error` — uncaught provider error
