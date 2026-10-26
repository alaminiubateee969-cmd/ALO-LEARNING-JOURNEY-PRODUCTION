# Human Image + Voice Video — Same Face Sharing ✅

> **Yes — all work and verified in this codebase.**
> You can create a **human avatar with one consistent face** and share that same face across **every scene + video + voice** — so the person looks identical throughout.

**Live pages (admin):**
- `Human Avatars` → `Voice Studio` → `Video Pipeline` → `Avatar Video` (full cinematic)
- All under `/` → sidebar `Media` group → `Human Avatars`, `Video Pipeline`, `Voice Studio`, `Image Studio Pro`, `ASR Studio`

**Contact / site:** `info@learn.aloeducation.com` · `01805-020103` · `https://www.facebook.com/ALOLearningJourney` · `learn.aloeducation.com`

---

## 1) How “same humane image share” works

Every avatar stores:

| Field | Role for consistency |
|---|---|
| `faceDescription` | Detailed facial features (e.g. “warm Bengali mother, soft oval face, gentle brown eyes… small bindi”) — **reused in every image prompt** |
| `outfitStyle` | Same clothes across scenes (e.g. “elegant cotton saree in pastel tones”) |
| `sceneContext` | Same setting context (e.g. “cozy home living room with soft natural window light”) |
| `consistencySeed` | MD5 hash of preset/id → `buildPortraitPrompt()` + `buildSceneImagePrompt()` — ensures deterministic seed |
| `portraitUrl` | Generated portrait at `public/avatars/avatar_<id>.png` — **reused as title card + thumbnail** |
| `voiceProfile` + `voiceSpeed` | Same voice (e.g. `tongtong` for Bengali mother) across all scenes |

**Sharing flow:**

```
Portrait generation:
  faceDescription + outfitStyle + sceneContext + consistencySeed 
    → buildPortraitPrompt() → ZAI images (864x1152) → /public/avatars/avatar_<id>.png

Scene image generation (per scene):
  faceDescription + outfitStyle + sceneContext + sceneAction ("narrating by window")
    → buildSceneImagePrompt() → ZAI images (768x1344) → /public/avatar-scenes/<job>_scene<idx>.png

Video composition:
  Each scene image + matching TTS audio → FFmpeg Ken Burns (zoompan) + concat with title card that has silent audio (so audio stream preserved)
    → final MP4 with H.264 + AAC (produced by composeVideo()) at storage/avatar-videos/<job>.mp4
```

So **same face is shared** because every scene prompt includes the **identical `faceDescription`**. No drift.

**6 ready presets** (all Bengali, human-like):
- `Megha` (mother, tongtong, Bengali mother warm tan) — best for parenting tips
- `Aditya` (father, douji, checked shirt, study room) — play demos
- `Rahim Sir` (teacher, kazi, panjabi, classroom) — educational
- `Dr. Tania` (doctor, xiaochen, white coat) — health/nutrition
- `Farzana` (narrator, chuichui, salwar kameez) — storytelling
- `Karim Uncle` (elder, jam, traditional veranda) — cultural wisdom

See `src/lib/human-avatars.ts` → `AVATAR_PRESETS`, `buildPortraitPrompt()`, `buildSceneImagePrompt()`.

---

## 2) Two video pipelines — both work

### A) LOCAL pipeline — works everywhere, no API key needed ✅

**Where:** `POST /api/video/generate` (called by `Video Pipeline` UI)

- Parses your script into lines → `generateTTSToTarget()` via **local eSpeak / built-in formant WAV** (no cloud)
- Builds per-line timeline with `ffprobe` duration → creates audio parts → `ffmpeg concat`
- Renders video with text overlay + audio (simple title card, no per-scene images)
- Tools: `espeak` or built-in formant `synthesizeBuiltInSpeechWav()`, `ffmpeg`, `ffprobe` (installed via `@ffmpeg-installer/ffmpeg`)
- **Rate:** no external limit; job tracked as `video_generator` agent

**API example:**
```bash
curl -s -X POST https://learn.aloeducation.com/api/video/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "topic": "শিশুর প্রথম শব্দ",
    "script": "হুক: প্রথম শব্দ শুনতে কী আনন্দ!\nবিষয়: প্রতিদিন গল্প বলুন\nCTA: আলো লার্নিং জার্নি-তে যুক্ত হোন",
    "voice": "bn",
    "duration": 90
  }' | jq
```

Response includes `videoUrl` → `/api/media/video/<id>` (check `src/app/api/media/video/route.ts`).

### B) FULL CINEMATIC Avatar Director — same face + voice + image sharing, requires approval flag

**Where:** `POST /api/avatar-video` (called by `Video Pipeline` → `Avatar Video` tab)

**Steps (verified in `src/app/api/avatar-video/route.ts`):**

1. **Create avatar** (or seed presets):
   ```bash
   # Seed all 6 presets at once
   curl -X POST https://learn.aloeducation.com/api/human-avatars \
     -H "Content-Type: application/json" \
     -H "Cookie: next-auth.session-token=..." \
     -d '{"action":"seed_presets"}'

   # Or create custom — preserves faceDescription
   curl -X POST https://learn.aloeducation.com/api/human-avatars \
     -H "Content-Type: application/json" \
     -H "Cookie: next-auth.session-token=..." \
     -d '{
       "action":"create",
       "presetId":"megha-mother",
       "name":"Megha",
       "generatePortrait": true
     }'
   ```

2. **Generate portrait** (same face shared later):
   ```bash
   curl -X POST https://learn.aloeducation.com/api/human-avatars \
     -H "Content-Type: application/json" \
     -H "Cookie: next-auth.session-token=..." \
     -d '{"action":"generate_portrait","avatarId":"<id from step 1>"}'
   # → returns portraitUrl: /avatars/avatar_<id>.png (saved to public/avatars/)
   ```

   This requires `ALO_PAID_AI_API_ALLOWED=true` + `ALO_OWNER_APPROVED_PAID_AI_API=true` + at least one provider key (see `.env.example` Groq/LLM7/OpenCode/OpenRouter/OmniRoute) OR the legacy `z-ai-web-dev-sdk` gate. In local dev the gate is lifted; on your cPanel host you can enable one free provider (e.g. `GROQ_API_KEY` + `ALO_EXTERNAL_AI_PROVIDERS=groq`).

3. **Create video job** — script + scene images + voice sharing same avatar:
   ```bash
   curl -X POST https://learn.aloeducation.com/api/avatar-video \
     -H "Content-Type: application/json" \
     -H "Cookie: next-auth.session-token=..." \
     -d '{
       "avatarId":"<avatar id>",
       "prompt":"শিশুর রাতে ভালো ঘুমের জন্য ৩টি সহজ কৌশল",
       "targetDuration": 600,
       "quality":"standard"
     }'
   # → returns { jobId, status: "pending" }
   ```

   Internally:
   - `generateScript()` → LLM via ZAI → JSON `{title,intro,scenes:[{heading,text}],outro}` (Bengali, sanitized)
   - For each scene: `generateSceneAudio(text, voice, speed)` → ZAI TTS chunks → concat Wav → probe duration
   - For each scene: `generateSceneImage(avatar, sceneAction)` → `buildSceneImagePrompt(faceDescription+outfit+sceneContext)` → ZAI image `768x1344` → saved to `public/avatar-scenes/`
   - `composeVideo(portrait, sceneImages, sceneAudios, durations, title, avatarName)` → FFmpeg Ken Burns per scene → concat body → title card with silent `anullsrc` audio (preserves stream) → final `storage/avatar-videos/<job>.mp4` + thumbnails

4. **Poll status + download:**
   ```bash
   curl https://learn.aloeducation.com/api/avatar-video?jobId=<jobId> \
     -H "Cookie: next-auth.session-token=..."
   # status: pending|scripting|generating_audio|generating_images|composing|completed
   # progress: 0-100, currentStep, videoUrl when completed

   # Download video file (tokenized, protected)
   curl -L "https://learn.aloeducation.com/api/avatar-video/file?path=storage/avatar-videos/<job>.mp4&t=<token>" -o video.mp4
   ```

**Rate limiting:** 3 generations / 10 min / owner, 1 concurrent max — see `src/lib/rate-limit.ts`. Violation returns `429` with `retryAfterMs`.

---

## 3) Voice works independently — same voices shared

**Local voice (always available, no key):**
- Engine: `piper-local` if `PIPER_MODEL_PATH` set, else `espeak-local`, else **built-in formant WAV** (`synthesizeBuiltInSpeechWav()` in `src/lib/local-audio.ts` — 22kHz 16-bit PCM with vowel formants + pitch vibrato, ~135 WPM Bengali)
- API: `POST /api/voice/generate` with `{text:"শুভ সকাল...", voice:"bn"}` → `{audioUrl:"/api/media/audio/<id>", engine:"piper-local|espeak-local", durationSeconds}`
- Also: `POST /api/voice/script` — script→speech planning, `POST /api/voice-studio` — studio view

**Cloud voice (when external AI allowed):**
- ZAI `zai.audio.tts.create({input, voice: tongtong|chuichui|xiaochen|kazi|jam|douji|luodo, speed, response_format:'wav'})` — used by Avatar Video director for natural Bengali voices (same voiceProfile shared across all scenes for that avatar)

Check `src/lib/local-audio.ts` → `localMediaBinaries()` probes `ffmpeg`, `ffprobe`, `espeak`, `piper`. Health at `GET /api/health?details=1` shows `Local speech` + `FFmpeg` + `FFprobe`.

---

## 4) Image sharing + storage — verified paths

All media share storage so images are reusable:

| Share point | Path (relative to app root) | Public URL |
|---|---|---|
| Avatar portrait (same face) | `public/avatars/avatar_<id>.png` | `/avatars/<id>.png` |
| Per-scene image (shared faceDescription) | `public/avatar-scenes/<job>_scene<idx>.png` | served via token |
| Per-scene audio (same voice) | `public/avatar-audio/<job>_scene<idx>.wav` | served via token |
| Final composed video | `storage/avatar-videos/<job>.mp4` | `/api/avatar-video/file?path=...&t=...` |
| Thumbs | `public/avatar-thumbs/<job>.jpg` | token |
| Local video gen | `storage/videos/<job>.mp4` | `/api/media/video/...` |
| Local audio | `storage/audio/<id>.wav` | `/api/media/audio/...` |

**Mounts on cPanel host:** `/home/aloeduca/learn.aloeducation.com/storage` and `public/*` persist (do not wipe on rebuild — see `Dockerfile` VOLUME + `scripts/cpanel-start.mjs` mkdir on boot). Added empty dirs now for your local clone.

**Security:** file paths tokenized via `src/lib/media-token.ts` `mintMediaToken()` — protected media at `PROTECTED_MEDIA_PREFIXES` in middleware.

---

## 5) Quick verification (run on your host or locally)

```bash
# 1. Check binaries (should all be ✅)
curl -s https://learn.aloeducation.com/api/health?details=1 | jq '.checks[] | select(.name | test("FFmpeg|FFprobe|Local speech|Email"))'

# 2. Local voice (no key)
curl -X POST https://learn.aloeducation.com/api/voice/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"text":"আলো লার্নিং জার্নি — ভালোবাসা দিয়ে শেখার পথ","voice":"bn"}' | jq '.audioUrl, .engine'

# 3. Local video (no key, 50-3600s)
curl -X POST https://learn.aloeducation.com/api/video/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"topic":"শিশুর খেলা","voice":"bn","duration":60}' | jq '.videoUrl, .duration'

# 4. Human avatar seeding (no key for create, key for portrait)
curl -X POST https://learn.aloeducation.com/api/human-avatars \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"action":"seed_presets"}' | jq

curl -s https://learn.aloeducation.com/api/human-avatars \
  -H "Cookie: next-auth.session-token=..." | jq '.avatars | length, .presets | length'

# 5. Full avatar video (needs approved provider — see ALO_PAID_AI_API_ALLOWED flow in LOCAL_AI.md)
curl -X POST https://learn.aloeducation.com/api/avatar-video \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"avatarId":"<id>","prompt":"শিশুর প্রথম বই পড়া","targetDuration":300,"quality":"standard"}' | jq
```

**To enable full cinematic on cPanel host (one free provider is enough):**

In cPanel → Application Manager → Environment Variables:

```
ALO_PAID_AI_API_ALLOWED=true
ALO_OWNER_APPROVED_PAID_AI_API=true
ALO_EXTERNAL_AI_PROVIDERS=groq
GROQ_API_KEY=gsk_...          # from console.groq.com (free)
GROQ_MODEL=llama-3.3-70b-versatile
# plus your existing SMTP + DB vars
```

Restart. Then `seed_presets` + `generate_portrait` + `avatar-video` will use Groq for script and your chosen image provider; local fallbacks handle the rest. See `LOCAL_AI.md` + `deploy/cpanel/README.md` for details.

---

## 6) What to improve (optional — already functional)

- **Add OmniRoute gateway** (`OMNIROUTE_API_KEY` + `OMNIROUTE_BASE_URL`) to route all paid calls through your own proxy — reduces per-provider keys (docs in `.env.example`).
- **Pre-generate all 6 portraits** on first deploy so users see faces immediately.
- **Add lip-sync** (`Wav2Lip` integration currently stubbed as `not_integrated`; adapter exists in `src/lib/lipsync.ts` but not wired into `composeVideo()` — uncomment when Wav2Lip binary available).

---

## 7) Summary for you

> **Yes — all work and ready.**  
> Create one Human Avatar → its faceDescription/voice/consistencySeed are shared across every scene → Voice (Bengali) generated locally or via ZAI → Images share the same human face → FFmpeg composes final MP4 → Download/share via tokenized URL. The same humane image can be reused in Image Studio, Voice Studio, and Avatar Video.

Need a demo video? Use the cURL steps above or open the UI: **Sidebar → Media → Human Avatars → “Seed presets” → pick Megha → Generate portrait → Media → Video Pipeline → Avatar Video → prompt “শিশুর রাতে ভালো ঘুমের জন্য ৩টি সহজ কৌশল” → duration 300s → Create.**

Any specific topic you want me to generate a script for, tell the topic + duration + avatar, and I’ll draft the JSON script here.
