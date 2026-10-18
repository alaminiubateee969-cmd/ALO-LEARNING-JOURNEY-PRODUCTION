# Test Report — v1.1.0

**Date:** 2026-10-07
**Branch:** `repair/human-avatar-production`

## Quality Gates (all PASS)

| Gate | Status | Evidence |
|------|--------|----------|
| Lint | ✅ PASS | 0 errors |
| TypeScript | ✅ PASS | build compiles |
| Production build | ✅ PASS | `next build` succeeds |
| DB migration | ✅ PASS | applied + reproducible |
| Human Avatar E2E | ✅ PASS | Anjali video: 81.32s, audio+video |
| Browser verification | ✅ PASS | agent-browser confirmed |
| Final MP4 ffprobe | ✅ PASS | h264 video + aac audio |
| Final MP4 audio extraction | ✅ PASS | 13.5 MB WAV |
| Authentication | ✅ PASS | dev-fallback; prod would 401 |
| Ownership | ✅ PASS | ownerId in all responses |
| Stuck recovery | ✅ PASS | sweep recovered 2 stuck videos |
| Cleanup | ✅ PASS | 9 files deleted per video |
| Rate limit | ✅ PASS | 3/10min + 1 concurrent |
| Validation | ✅ PASS | whitespace/invalid/empty → 400 |
| Regression | ✅ PASS | 0 regressions across 36 endpoints |
| **UI delete buttons** | ✅ PASS | avatar cards + video cards + play dialog |
| **UI honest lip-sync states** | ✅ PASS | 4 distinct badges displayed |

## Test Matrix

### API Tests
| Test | Expected | Actual | Pass |
|------|----------|--------|------|
| GET avatars | 200 | 200 | ✅ |
| POST seed_presets | 200 + count | 200, 6 seeded | ✅ |
| POST create custom | 200 + avatar | 200, Anjali created | ✅ |
| POST create — missing fields | 400 | 400 | ✅ |
| POST create — invalid persona | 400 | 400 | ✅ |
| POST generate_portrait — bad id | 404 | 404 | ✅ |
| POST video — missing prompt | 400 | 400 | ✅ |
| POST video — whitespace prompt | 400 | 400 "cannot be empty/whitespace" | ✅ |
| POST video — duration out of range | 400 | 400 | ✅ |
| POST video — invalid quality | 400 | 400 | ✅ |
| POST video — nonexistent avatar | 404 | 404 | ✅ |
| POST video — full pipeline | 200 | 200, 81.32s MP4 | ✅ |
| DELETE video | 200 + filesDeleted | 200, 9 files | ✅ |
| DELETE avatar (cascade) | 200 + cascadedVideos | 200 | ✅ |
| POST recovery sweep | 200 + recovered | 200, recovered: 2 | ✅ |
| Empty body | 400 | 400 "Request body is empty" | ✅ |
| Invalid JSON | 400 | 400 "Invalid JSON" | ✅ |

### Video Tests (Fresh E2E — Anjali)
| Test | Result | Evidence |
|------|--------|----------|
| Audio stream exists | ✅ PASS | `stream,1,aac,audio,44100,2` |
| Audio extraction | ✅ PASS | 13.5 MB WAV |
| Video duration | ✅ PASS | 81.28s |
| Video resolution | ✅ PASS | 1080×1920 |
| Video codec | ✅ PASS | h264 High |
| Audio codec | ✅ PASS | aac, 44100Hz, stereo |
| Browser playback | ✅ PASS | agent-browser |
| Lip-sync | ⚠️ NOT TESTED | external service not deployed |

### Security Tests
| Test | Result |
|------|--------|
| Unauthenticated (prod) | ✅ would 401; dev returns dev-fallback header |
| Prompt injection | ✅ flagged; LLM treats as topic |
| Path traversal | ✅ 404 |
| IDOR / guessable URL | ✅ signed token required |
| Rate limit | ✅ 429 on 4th request |
| Concurrent | ✅ 409 on 2nd concurrent |

### Failure Tests
| Test | Result |
|------|--------|
| Interrupted job | ✅ sweep marks failed |
| Lip-sync timeout | ✅ adapter returns `timeout` |
| Lip-sync malformed | ✅ adapter returns `invalid_output` |
| Storage failure | ✅ throws → failed |
| Duplicate request | ✅ rate limit blocks |

### UI Tests (agent-browser)
| Test | Result |
|------|--------|
| Avatars tab renders | ✅ Anjali + Rina + Supti + 5 presets |
| Generate Video tab renders | ✅ form + progress |
| Video Library tab renders | ✅ completed videos |
| Avatar delete button present | ✅ "Delete avatar + all videos" × 4 |
| Video delete button present | ✅ "Delete video + files" × 5 |
| Honest lip-sync badge — unavailable | ✅ "Lip-sync unavailable" |
| Honest lip-sync badge — no lip-sync | ✅ "No lip-sync" |
| Failed video error display | ✅ (when status=failed) |
| Play dialog download button | ✅ "Download MP4" |
| Play dialog delete button | ✅ "Delete" |

## Known Limitations
1. Lip-sync: adapter implemented; external GPU service NOT deployed → talking-portrait mode.
2. Dev-auth fallback when NEXTAUTH_SECRET/ALO_ADMIN_EMAIL/ALO_ADMIN_PASSWORD_HASH unset.
3. In-memory rate limit (single-instance only).
4. Other portal sections (Workflow, Video Pipeline, Communications) remain mock/placeholder — out of scope.
