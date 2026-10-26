# Photo → Video Studio

**Status:** implemented and verified on this checkout (2026-10-26).
**Cost:** ₹0 / $0 — every stage runs on the ALO server. No hosted model, gateway,
avatar service or render farm is contacted.

> Upload one or more photos → the agent adds camera motion, writes/spoken
> Bangla narration, composes a music bed, burns captions and exports a finished
> H.264 + AAC MP4 with a sidecar `.srt`.

---

## 1. Why this exists

Before this pass the product could generate storyboards, images, voice and music,
but there was **no path from an owner's own photo to a finished video** — and six
finished screens (Diagram Studio, Marketing Kits, Audio Studio, Admissions CRM,
Photo + Voice Clone, API Reference) were never mounted in the app shell, so the
work behind them was unreachable from the UI. Both gaps are closed here.

## 2. Where it lives

| Surface | File |
|---|---|
| UI screen (nav: **Media → Photo → Video**) | `src/components/alo/PhotoToVideoStudio.tsx` |
| Render API (`POST`), gallery (`GET`) | `src/app/api/video/from-photo/route.ts` |
| Planning engine (pure, testable) | `src/lib/photo-video.ts` |
| MP4 streaming | `src/app/api/media/video/[id]/route.ts` (`pv_…` ids) |
| Subtitle download | `src/app/api/media/subtitle/[id]/route.ts` |
| Thumbnail | `src/app/api/media/thumbnail/[id]/route.ts` |
| Tests (34 assertions) | `tests/photo-video.test.mjs` |

The screen is also reachable from **Cmd+K** ("Photo → Video Studio"), the floating
quick-action menu, and the **Video Pipeline** screen (its *Storyboard Images* and
*Render Video (MP4)* buttons are now wired to real endpoints instead of being
dead placeholders).

## 3. Pipeline stages

1. **Validate & normalise photos** — magic-byte sniffing (`jpeg/png/webp/gif/avif/heic`),
   size/count limits, then FFmpeg `scale … increase → crop → setsar` to a 2× output
   frame. *No Sharp dependency* (see §7).
2. **Narration split** — `splitNarration()` uses one line per photo when the owner
   writes it that way, otherwise balances sentences by character weight.
3. **Local voice** — `synthesizeLocalSpeech()` → Piper if configured, else eSpeak,
   else the built-in 22 kHz formant synthesiser (`builtin-formant`). Measured with
   ffprobe; each shot's duration follows the spoken length (+0.5 s headroom).
4. **Music bed** — `generateProceduralInstrumental()` (deterministic, seeded per
   render, four moods) at the chosen bed volume.
5. **Camera motion** — `buildMotionFilter()` emits a `zoompan` graph per photo:
   push-in, pull-out, pan L/R, tilt up/down, orbit or static. `auto` rotates the
   preset so consecutive shots never repeat.
6. **Join** — `buildXfadeFilterComplex()` (crossfade/dissolve/slide/wipe/circle)
   with offsets `Σd − k·t`. FFmpeg builds without `xfade` (Ubuntu 18.04-era static
   binaries, some Windows builds) automatically fall back to `buildDipToBlackGraph()`
   — detection happens once per process.
7. **Captions** — `wrapCaption()` → per-shot `textfile` for `drawtext` (Hind Siliguri
   from `public/fonts/`, so no shell-escaping of Bengali punctuation), plus a real
   `.srt` written with `buildSrt()`.
8. **Mix & mux** — `buildAudioMixPlan()` (voice, music, or silence) → `amix` →
   `loudnorm` → 1.2 s fade-out → AAC 160 kb/s 44.1 kHz stereo.
9. **Validate & persist** — ffprobe must report video **and** audio, else the render
   fails loudly. Result JSON is written to `storage/videos/pv_<uuid>.json`, logged
   through the agent runtime (`video_generator`) and recorded in `MediaGeneration`
   (`stage: "photo_video"`). The working directory is always removed.

## 4. API

### `POST /api/video/from-photo` — `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `images` | File[] | 1–12 photos, ≤15 MB each, ≤120 MB total |
| `imagePaths` | JSON string[] | Alternative to upload: `/generated/…`, `/avatar-scenes/…`, `/avatars/…` only |
| `title` | string | ≤120 chars, drawn on the first frame |
| `narration` | string | ≤4000 chars; newline = new photo, otherwise auto-balanced |
| `captions_json` | JSON string[] | Explicit per-photo captions (overrides narration split) |
| `audio` | File | Optional finished voice track; its length is split evenly across photos |
| `voice` | string | `bn`, `bn+f2`, `en`, `en+f3`, `hi`, … |
| `aspect` | enum | `vertical` (1080×1920) · `portrait` (1080×1350) · `square` · `landscape` (1920×1080) · `wide` (1920×824) |
| `quality` | enum | `draft` (0.66×, crf 26) · `standard` (crf 22) · `hd` (crf 19, 30 fps) |
| `motion` | enum | `auto` + the eight presets in `MOTION_PRESETS` |
| `transition` / `transitionSec` | enum / number | 0–1.2 s; clamped to 45 % of the shortest shot |
| `shotSec` | number | 1.5–12 s (ignored when narration drives the timing) |
| `captions`, `captionStyle` | 0/1, enum | burned captions + `.srt` |
| `music`, `musicVolume` | enum, 0–0.5 | `none`/`calm`/`hopeful`/`playful`/`reflective` |
| `engine` | string | must be `local`; `sora`, `veo`, `kling`, `runway`, `heygen`, `synthesia`, `elevenlabs`, `d-id`, `luma`, `pika`, `replicate-paid` are rejected (400) |

Response (200):

```json
{
  "ok": true,
  "id": "pv_…",
  "videoUrl": "/api/media/video/pv_…",
  "srtUrl": "/api/media/subtitle/pv_…",
  "thumbnailUrl": "/api/media/thumbnail/pv_…",
  "durationSec": 6.56, "width": 1080, "height": 1920, "fps": 25,
  "sizeBytes": 1234016, "aspect": "vertical", "quality": "standard",
  "shots": [{ "index": 0, "caption": "…", "startSec": 0, "endSec": 2.278, "motion": "kenburns-in" }],
  "voiceEngine": "builtin-formant", "musicEngine": "local-procedural-synth",
  "captionsBurned": true,
  "policy": { "freeOnly": true, "paidApisUsed": false, "engines": [ … ] }
}
```

Errors are structured: `415` for non-image/undecodable uploads, `413` for oversized
payloads, `400` for bad paths or a paid engine, `500` with `detail` + `hint` when the
media toolchain is missing.

### `GET /api/video/from-photo`

* default → `{ renders: […] }` (merged DB + on-disk manifests, 24 newest)
* `?images=1` → recent `/generated` images for the "use Image Studio output" picker

## 5. Free-only guarantee

`FREE_PIPELINE_POLICY` (`src/lib/photo-video.ts`) is returned by every render and
asserted by the tests:

| Stage | Engine | Cost |
|---|---|---|
| Image motion | local FFmpeg `zoompan` | $0 |
| Voice | Piper / eSpeak / ALO formant synth | $0 |
| Music | ALO procedural synth (no weights, no licence) | $0 |
| Encode | local FFmpeg + libx264 | $0 |
| Captions | local `drawtext` + SRT | $0 |

Optional AI *writing* (narration drafts) still passes through the existing
free-tier allowlist and `assertExternalAiAllowed()` payment guard — never the
render path itself.

## 6. Verification performed

* `npx tsc --noEmit` → clean.
* `node --experimental-strip-types --test tests/*.test.mjs` → **123 tests pass**
  (34 of them new for this pipeline).
* Live end-to-end on a running dev server:
  * 3 photos + Bangla narration + music + burned captions → **6.56 s, 1080×1920,
    1.2 MB MP4**, H.264 + AAC, `.srt` with correct Bengali cues, thumbnail 200 OK.
  * silent / no-caption / landscape render → 4 s 1268×714 with a real (silent)
    AAC track.
  * owner-uploaded voice WAV → evenly split across photos, `voiceEngine: owner-upload`.
  * `engine=heygen` → 400 blocked; `imagePaths=["/etc/passwd"]` → 400 rejected.
  * Visual frame inspection confirmed Hind Siliguri captions and the title plate
    render correctly.

## 7. Known limits (deliberate, documented)

* **Sharp is not used.** The production VPS (Intel Core 2 Duo E7500, no SSE4.2)
  cannot load Sharp's prebuilt binary, and `tests/image-processing.test.mjs`
  forbids eager Sharp imports. The whole pipeline is FFmpeg-only.
* **HEIC/AVIF** depend on the server FFmpeg having a HEIF decoder; when it does not,
  the API returns `415` with an explicit "export as JPEG" hint.
* **Bengali shaping** in `drawtext` is glyph-by-glyph (no HarfBuzz shaping of the
  `drawtext` filter itself); conjunct clusters look correct in the tested build
  because Hind Siliguri carries the pre-shaped glyphs. The sidecar `.srt` gives
  pixel-perfect shaping in any player, so both are produced.
* **Old FFmpeg builds**: no `xfade` → automatic fade-to-black joins. `amix`'s
  `normalize` option (FFmpeg ≥ 4.4) is never emitted.
* Renders are synchronous (2–20 s for typical photo counts). `maxDuration = 300`
  is declared on the route; there is no background queue yet — a 12-photo HD job
  on a slow CPU is the practical ceiling.

## 8. Ops checklist after deploy

```bash
node scripts/verify-media-pipeline.mjs     # ffmpeg / ffprobe / TTS availability
npx tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
curl -s -X POST http://127.0.0.1:3000/api/video/from-photo \
  -F images=@photo.jpg -F narration="একটি ছোট পরীক্ষা।" -F quality=draft | head -c 400
```

Outputs land in `storage/videos/` and are served only through
`/api/media/video/pv_<uuid>` — never as raw static files, so the existing
authentication middleware still applies.
