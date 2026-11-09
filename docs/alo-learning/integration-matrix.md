# ALO Learning — Integration Matrix

> **Document type:** Decision matrix and concrete integration plan (Phase 1/2 deliverable)
> **Date:** 2026-11-05
> **Author:** Z.ai
> **Companion documents:** `baseline-audit.md`, `repository-audit.md`, `architecture.md`, `security-review.md`, `database-design.md`, `deployment-guide.md`, `testing-report.md`, `production-readiness.md`.

---

## Purpose

This document satisfies **Section 3 (decision matrix)** and **Section 4 (adapter architecture)** of the ALO Learning Master Engineering & Integration Directive. For every candidate repository, it specifies: verdict, integration mode, license compatibility, effort, dependencies, sequenced phase, ALO service consuming the repo, adapter file, env vars required, risks and mitigations.

The directive's FINAL RULE applies: **never blindly clone every project into the production app. Use isolated services and adapters.**

---

## 1. Master integration matrix

| # | Repo | License | Verdict | Mode | Effort | Phase | ALO service | Adapter file |
|---|---|---|---|---|---|---|---|---|
| 1 | voicebox | MIT | **INTEGRATE** | Sidecar (FastAPI) | M | 3 | AI Voice Engine | `adapters/voice/voicebox.ts` |
| 2 | sms.domovina.ai | AGPL-3.0 | **ADAPT** | Network service | M | 4 | SMS Gateway Engine | `adapters/sms/domovina.ts` |
| 3 | httpSMS (self-host) | AGPL-3.0 | **OPTIONAL** | Network service | L | 4 | SMS Gateway Engine | `adapters/sms/httpsms-self-hosted.ts` |
| 4 | httpsms-node | MIT | **ALREADY IN USE** | Embedded (npm) | S | — | (existing) | (existing) |
| 5 | linphone-iphone | GPL-3.0+ | **REJECT** | — | — | — | — | — |
| 6 | VoIP (0perationPrivacy) | GPL-3.0 | **REJECT** | — | — | — | — | — |
| 7 | ipftrace2 | GPL-2.0/BSD-2 | **REFERENCE ONLY** | (ops tool) | — | — | (ops) | — |
| 8 | VoIP-Call-Sample | MIT | **REJECT** | — | — | — | — | — |
| 9 | electron-promise-ipc | MIT | **REJECT** | — | — | — | — | — |
| 10 | VideoCaptioner | GPL-3.0 | **ADAPT** | Sidecar (Whisper-local) | M | 9 | Cinematic Editing (subtitles) | `adapters/subtitles/videocaptioner.ts` |
| 11 | Pixelle-Video | Apache-2.0 | **ADAPT** | Port patterns | L | 7 | Video Generation Engine | (port to `services/video/pipeline.ts`) |
| 12 | Remotion | Custom | **OPTIONAL** | Sidecar (render worker) | L | 7 | Cinematic Editing Engine | `adapters/video/remotion.ts` |
| 13 | VideoCode | NO LICENSE | **REJECT** | — | — | — | — | — |
| 14 | 3b1b/videos | CC BY-NC-SA | **REJECT** | — | — | — | — | — |
| 15 | youtube-dl / yt-dlp | Public Domain | **ADAPT** | Sidecar (binary) | S | 7 | Learning Intelligence Engine | `adapters/youtube/ytdlp.ts` |
| 16 | claude-video | MIT | **INTEGRATE** | Skill pattern | S | 11 | AI Workforce (AgentOS) | `agents/skills/watch.ts` |
| 17 | InfiniteTalk | Apache-2.0* | **REJECT** | — | — | — | — | — |
| 18 | VideoRecorder | Apache-2.0 | **REJECT** | — | — | — | — | — |
| 19 | CogVideo | Apache-2.0* | **OPTIONAL (deferred)** | Sidecar (GPU box) | L | 8 (deferred) | Video Generation Engine | `adapters/video/cogvideo.ts` |
| 20 | HunyuanVideo | Apache-2.0* | **REJECT** | — | — | — | — | — |
| 21 | RedditVideoMakerBot | GPL-3.0 | **REJECT** | — | — | — | — | — |
| 22 | ComfyUI_RH_APICall | NO LICENSE | **REJECT** | — | — | — | — | — |
| 23 | CLI-Anything | Apache-2.0 | **OPTIONAL (pilot)** | Sidecar + skill source | M | 11 | AI Workforce (AgentOS) | `adapters/agentos/cli-anything.ts` |

\* Apache-2.0 marks the code license for CogVideo / HunyuanVideo / InfiniteTalk. The model weights carry separate, more restrictive licenses.

---

## 2. Integration specifications

### 2.1 voicebox — INTEGRATE (Phase 3, M effort, MIT)

**Integration mode:** sidecar — voicebox's FastAPI backend deployed via `docker-compose.yml` on the ALO VPS (port 8000 internal). The Tauri desktop UI is NOT deployed.

**Adapter file:** `src/lib/alo-learning/adapters/voice/voicebox.ts`

**Public adapter API:**
```typescript
export class VoiceboxAdapter {
  async generate(req: {
    text: string;
    engine: "kokoro" | "qwen3-tts" | "chatterbox" | "lux-tts" | string;
    language: "bn" | "en" | "auto";
    voiceProfileId?: string;  // for cloning
    outputFormat: "wav" | "mp3";
  }): Promise<{ audioPath: string; durationMs: number; engineUsed: string }> {}

  async transcribe(req: {
    audioPath: string;
    language?: "bn" | "en" | "auto";
  }): Promise<{ transcript: string; segments: Array<{ start: number; end: number; text: string }> }> {}

  async health(): Promise<{ status: "connected" | "disconnected"; version: string; enginesLoaded: string[] }> {}
}
```

**Env vars required (added to `.env.example`):**
```
# Voicebox (local TTS sidecar)
ALO_VOICEBOX_ENABLED=false
ALO_VOICEBOX_BASE_URL=http://127.0.0.1:8000
ALO_VOICEBOX_DEFAULT_ENGINE=kokoro
ALO_VOICEBOX_DEFAULT_LANGUAGE=bn
```

**Dependencies:** voicebox FastAPI backend deployed (Docker); GPU recommended but not required (Kokoro runs on CPU).

**Integration points in ALO:**
- `src/lib/alo-learning/services/voice/engines/voicebox.ts` calls the adapter.
- `src/lib/local-audio.ts#synthesizeLocalSpeech()` is updated to try voicebox first (when `ALO_VOICEBOX_ENABLED=true`), then Piper → espeak → formant fallback chain (preserved).
- `src/app/api/alo-learning/voice/generate/route.ts` exposes the new endpoint.

**Risks:**
- 8GB+ VRAM if loading Qwen3-TTS + Whisper Large + personality LLM simultaneously. **Mitigation:** load engines on-demand.
- Tauri/Rust toolchain is heavy build. **Mitigation:** deploy only the FastAPI backend.

**Acceptance criteria:**
- Voicebox adapter health check returns "connected" when running.
- A POST to `/api/alo-learning/voice/generate` with `engine: kokoro` returns a synthesized MP3 within 5 seconds on CPU.
- If voicebox is down, the existing Piper/espeak/formant chain is used and the request still succeeds.

---

### 2.2 sms.domovina.ai — ADAPT (Phase 4, M effort, AGPL-3.0)

**Integration mode:** network service (sidecar). The `webhook/` Hono service is deployed as a separate Bun process. **NOT bundled into ALO's Next.js process** (AGPL-3.0).

**Adapter file:** `src/lib/alo-learning/adapters/sms/domovina.ts`

**Env vars required:**
```
# sms.domovina.ai Reverse OTP sidecar (AGPL-3.0; separate process)
ALO_DOMOVINA_ENABLED=false
ALO_DOMOVINA_BASE_URL=http://127.0.0.1:8090
```

**Dependencies:** Bun runtime on the VPS; the `webhook/` Hono service deployed; storage swapped from in-memory `Map` to SQLite.

**Integration points:**
- `src/lib/alo-learning/services/sms/providers/sms-domovina.ts` calls the adapter.
- `src/app/api/alo-learning/auth/reverse-otp/{issue,verify}/route.ts` exposes the new endpoints.
- Existing httpSMS-hosted OTP flow is preserved; Reverse OTP is an additional option.

**Risks:**
- AGPL-3.0 triggers full-source disclosure if bundled. **Mitigation:** sidecar deployment.
- Reverse OTP is PoC with in-memory storage. **Mitigation:** swap for SQLite before production use.
- Android release builds reuse debug signing. **Mitigation:** operator's responsibility.

**Acceptance criteria:**
- Admin can issue a Reverse OTP challenge via the UI.
- The challenge is stored in SQLite (not in-memory).
- After the admin texts the code to the gateway, the webhook fires, and the challenge is marked verified.
- Consent is logged to `MediaAuditLog`.

---

### 2.3 httpSMS (self-host) — OPTIONAL (Phase 4, L effort, AGPL-3.0)

**Integration mode:** network service (sidecar). Self-hosting httpSMS is OPTIONAL — ALO currently uses the hosted SaaS.

**Adapter file:** `src/lib/alo-learning/adapters/sms/httpsms-self-hosted.ts`

**Env vars required:**
```
# httpSMS self-hosted (AGPL-3.0; optional alternative to hosted SaaS)
ALO_HTTPSMS_SELF_HOSTED=false
ALO_HTTPSMS_SELF_HOSTED_BASE_URL=http://127.0.0.1:8091
```

**Dependencies:** Go Fiber, Vue/Nuxt 3 web UI, Firebase Cloud Messaging, CockroachDB/Postgres, Redis, Cloudflare Turnstile, always-on Android device.

**Risks:**
- AGPL-3.0 incompatible with closed-source SaaS distribution. **Mitigation:** sidecar deployment.
- Self-host requires substantial infrastructure. **Mitigation:** do not self-host unless operational capacity exists.
- Upstream issue #881: rotated API keys remain valid up to 2h. **Mitigation:** document in `deployment-guide.md`.

**Acceptance criteria (only if self-host is enabled):**
- The self-hosted httpSMS server is healthy and the Android gateway is online.
- A POST to `/api/alo-learning/sms/send` with `provider: httpsms-self-hosted` sends an SMS and receives a delivery webhook.
- AGPL source disclosure is documented in the deploy manifest.

---

### 2.4 VideoCaptioner — ADAPT (Phase 9, M effort, GPL-3.0)

**Integration mode:** sidecar (Python process). **NOT bundled into ALO's Next.js process** (GPL-3.0). Configured for Whisper-local mode only — the default Bcut/Jianying cloud ASR is disabled.

**Adapter file:** `src/lib/alo-learning/adapters/subtitles/videocaptioner.ts`

**Env vars required:**
```
# VideoCaptioner sidecar (GPL-3.0; separate process; Whisper-local only)
ALO_VIDEOCAPTIONER_ENABLED=false
ALO_VIDEOCAPTIONER_BASE_URL=http://127.0.0.1:8092
ALO_VIDEOCAPTIONER_DEFAULT_ENGINE=whisper-local
ALO_VIDEOCAPTIONER_DEFAULT_LANGUAGE=bn
```

**Dependencies:** Python 3.9+; faster-whisper or whisper-cpp installed; ffmpeg (ALO already has).

**Risks:**
- GPL-3.0 viral copyleft. **Mitigation:** sidecar deployment.
- Default free ASR is Bcut (Bilibili) + Jianying (ByteDance) cloud. **Mitigation:** adapter hard-codes `engine: "whisper-local"` (or faster-whisper / whisper-cpp); never "bcut" or "jianying".
- Whisper fallback is CPU-slow. **Mitigation:** queue via BullMQ; document expected duration in UI.

**Acceptance criteria:**
- A 5-minute Bangla video is transcribed within 10 minutes on CPU (or 30 seconds on GPU).
- SRT and VTT exports are valid.
- Burned subtitles render HindSiliguri font correctly for Bangla.

---

### 2.5 Pixelle-Video — ADAPT (Phase 7, L effort, Apache-2.0)

**Integration mode:** port patterns — NOT the Streamlit app. ALO ports the HTML/CSS template engine and the pipeline orchestration patterns to its own Next.js routes.

**Adapter file:** (no adapter — direct port to `src/lib/alo-learning/services/video/pipeline.ts`)

**Env vars required:** none new.

**Dependencies:** none new — ALO reuses its existing ComfyUI local + ffmpeg + voice engine.

**Risks:**
- Maintained by AIDC-AI (Alibaba International); docs/community Chinese-first. **Mitigation:** English-only adoption.
- Architecturally duplicates ALO's Next.js studio. **Mitigation:** port only the template engine and pipeline patterns.
- Bundled ComfyUI workflows drag in their own model licenses. **Mitigation:** do not bundle Pixelle's workflow JSON.

**Acceptance criteria:**
- ALO's video pipeline produces a 30-second educational video using one of the 10 templates.
- The template engine renders Bangla captions with HindSiliguri font.
- No Pixelle code is bundled — only the architectural pattern is adopted.

---

### 2.6 Remotion — OPTIONAL (Phase 7, L effort, custom license)

**Integration mode:** sidecar (render worker) — Remotion runs as a separate Node.js process (or Remotion Lambda on AWS).

**Adapter file:** `src/lib/alo-learning/adapters/video/remotion.ts`

**Env vars required:**
```
# Remotion (custom two-tier license; check Company License if >3 employees)
ALO_REMOTION_ENABLED=false
ALO_REMOTION_LICENSE_TYPE=individual  # or "company" if license purchased
ALO_REMOTION_BASE_URL=http://127.0.0.1:8093
# OR for Lambda:
ALO_REMOTION_LAMBDA_REGION=us-east-1
ALO_REMOTION_LAMBDA_FUNCTION_NAME=remotion-render
```

**Dependencies:** Node 18+; Chromium (bundled with Remotion); ffmpeg-backed `compositor` binary per OS.

**Risks:**
- Custom two-tier license — if tech360-bd employs >3 people, Company License fee applies. **Mitigation:** confirm employee count before enabling; default `ALO_REMOTION_ENABLED=false`.
- Huge dependency footprint (14483 files). **Mitigation:** sidecar deployment isolates the footprint.
- Per-OS compositor binary complicates containers. **Mitigation:** use the official Remotion Docker image.

**Acceptance criteria (only if enabled):**
- A composition renders to MP4 within the expected duration.
- The health endpoint reports the correct license type.
- The Company License (if applicable) is documented in the deploy manifest.

---

### 2.7 yt-dlp (via youtube-dl lineage) — ADAPT (Phase 7, S effort, Public Domain)

**Integration mode:** sidecar (binary) — `yt-dlp` installed as a Python pip package or standalone binary on the ALO VPS.

**Adapter file:** `src/lib/alo-learning/adapters/youtube/ytdlp.ts`

**Env vars required:**
```
# yt-dlp (YouTube sourcing; Public Domain)
ALO_YTDLP_ENABLED=false
ALO_YTDLP_BIN=yt-dlp
ALO_YTDLP_DEFAULT_LICENSE_FILTER=creative_common
```

**Dependencies:** yt-dlp binary; ffmpeg for format conversion (ALO already has).

**Risks:**
- YouTube ToS prohibits bulk downloading. **Mitigation:** honor CC-licensed content only; respect rate limits; do not bypass age-restriction or DRM.
- yt-dlp breaks periodically when YouTube changes its player. **Mitigation:** pin the version; update monthly.

**Acceptance criteria:**
- A CC-licensed YouTube URL imports successfully and the MP4 is saved to `./storage/imports/`.
- Non-CC content is rejected with a clear error message.
- Import rate is limited to 10 per hour per admin session.

---

### 2.8 claude-video — INTEGRATE (Phase 11, S effort, MIT)

**Integration mode:** skill pattern — adopt the SKILL.md pattern, implement the watch skill natively in ALO's AgentOS.

**Adapter file:** `src/lib/alo-learning/agents/skills/watch.ts`

**Env vars required:**
```
# /watch skill (agent session recording)
ALO_WATCH_SKILL_ENABLED=false
ALO_WATCH_OUTPUT_DIR=./storage/agent-recordings
ALO_WATCH_RETENTION_DAYS=30
```

**Dependencies:** ffmpeg with x11grab (Linux) or avfoundation (macOS dev).

**Risks:**
- Storage growth (each agent-run MP4 is 10-50MB). **Mitigation:** retention policy (`ALO_WATCH_RETENTION_DAYS=30`); delete recordings >30 days old, keep only failed runs.

**Acceptance criteria:**
- An agent run with the watch skill enabled produces an MP4 saved to `./storage/agent-recordings/`.
- Recordings older than `ALO_WATCH_RETENTION_DAYS` are deleted by a daily cron.
- Failed agent runs (status: "failed") are preserved regardless of age.

---

### 2.9 CLI-Anything — OPTIONAL (Phase 11, M effort, Apache-2.0)

**Integration mode:** sidecar + skill source — `cli-anything-hub` Python package installed on the VPS; ALO's adapter calls installed skills via `spawnSync("cli-hub", ["run", skillName, "--json", ...])`.

**Adapter file:** `src/lib/alo-learning/adapters/agentos/cli-anything.ts`

**Env vars required:**
```
# CLI-Anything (agent-native CLI orchestration; Apache-2.0)
ALO_CLI_ANYTHING_ENABLED=false
ALO_CLI_ANYTHING_BIN=cli-hub
ALO_CLI_ANYTHING_INSTALLED_SKILLS=audacity,blender
```

**Dependencies:** Python 3.10+; `pip install cli-anything-hub`; each skill installed via `cli-hub install <name>`.

**Risks:**
- Large dependency footprint (97MB repo, 1872 files). **Mitigation:** install only the skills ALO uses.
- Community-contributed skill quality varies. **Mitigation:** audit each skill's code before install.
- `cli-hub` installer pulls from public registry. **Mitigation:** pin skill versions in a lockfile.

**Acceptance criteria (pilot):**
- The `audacity` skill is installed and `runSkill({ skillName: "audacity", args: ["--version"] })` returns the Audacity version.
- An agent run with the `audio_editor` agent type produces a trimmed MP3 via Audacity.
- The skill catalog UI lists installed skills with their versions.

---

### 2.10 CogVideo — OPTIONAL (Phase 8, deferred, L effort, Apache-2.0 code + restrictive weights)

**Integration mode:** sidecar (GPU box) — only if ALO's avatar-video volume grows enough to justify a dedicated 16-24GB GPU VPS.

**Adapter file:** `src/lib/alo-learning/adapters/video/cogvideo.ts`

**Env vars required:**
```
# CogVideo (self-hosted text-to-video; deferred)
ALO_COGVIDEO_ENABLED=false
ALO_COGVIDEO_BASE_URL=http://<gpu-box-ip>:8094
ALO_COGVIDEO_MODEL=cogvideox-5b
```

**Dependencies:** Dedicated GPU VPS (16-24GB VRAM); CogVideoX weights; Zhipu commercial license registration.

**Risks:**
- 1M-visits/month cap; Chinese-law jurisdiction. **Mitigation:** legal sign-off before enabling.
- Duplicates the Z.ai vendor relationship ALO already pays via `z-ai-web-dev-sdk`. **Mitigation:** compare cost; likely defer indefinitely.

**Acceptance criteria (only if enabled):**
- The CogVideo sidecar is healthy and the model is loaded.
- A POST to the adapter's `generate()` produces a 5-second MP4 within 60 seconds.
- Commercial registration is documented in the deploy manifest.

---

## 3. Rejected integrations (with reasons)

| Repo | Reason for rejection |
|---|---|
| linphone-iphone | GPL-3.0+ dual license + Swift/iOS-only + wrong form factor |
| VoIP (0perationPrivacy) | GPL-3.0 copyleft + dormant + wrong scope |
| VoIP-Call-Sample | Dormant XML sample-only with no reusable code |
| electron-promise-ipc | Electron-only + dormant + wrong runtime |
| VideoCode | NO LICENSE + not even a video tool |
| 3b1b/videos | CC BY-NC-SA 4.0 NonCommercial — blocks commercial ALO use |
| InfiniteTalk | Wan2.1-14B requires A100 40-80GB; not single-VPS feasible |
| VideoRecorder | Abandoned 2014-era Android code |
| HunyuanVideo | Tencent Community License excludes EU/UK/KR + 45-80GB VRAM infeasible |
| RedditVideoMakerBot | GPL-3.0 + Reddit ToS risk + content quality mismatch |
| ComfyUI_RH_APICall | NO LICENSE + violates local-first principle + vendor lock-in |

---

## 4. License compatibility matrix

For ALO as a closed-source commercial SaaS, licenses divide into four bands:

| Band | Licenses | Safe for ALO? | Notes |
|---|---|---|---|
| Green | MIT · Apache-2.0 · BSD-2/3 · Public Domain · Unlicense | Yes — bundle freely | No copyleft, no attribution beyond notice file |
| Amber | GPL-2.0/3.0 · LGPL · MPL-2.0 · Custom · Dual | Conditional — legal review required | GPL viral if linked; MPL file-level; custom (Remotion) per-case |
| Red | AGPL-3.0 · CC BY-NC-SA · SSPL · Elastic | No — blocks closed-source SaaS | AGPL triggers source disclosure on network use; NC blocks commercial |
| Black | NO LICENSE | No — all rights reserved by default | No reuse without explicit written permission |

**Of the 23 repos: 8 are green, 4 are amber, 7 are red (including model-weight restrictions), 2 are black, 2 are already in use.**

---

## 5. Adapter pattern (mandatory for all external services)

```typescript
// src/lib/alo-learning/adapters/<service>/<name>.ts
import { AuditLog } from "@/lib/db";
import { requireOwner } from "@/lib/alo-learning/auth";

export interface AdapterHealth {
  status: "connected" | "disconnected";
  version: string;
  lastError?: string;
}

export abstract class BaseAdapter {
  constructor(protected readonly baseUrl: string, protected readonly apiKeyEnv: string) {}

  protected async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey && this.requiresApiKey()) {
      throw new Error(`Missing env var: ${this.apiKeyEnv}`);
    }
    // ... HTTP call with retries, timeout, circuit breaker
    // ... audit log to AuditLog model
  }

  abstract health(): Promise<AdapterHealth>;
  protected requiresApiKey(): boolean { return true; }
}
```

Adapters are the only place external credentials are referenced. Production credentials live in `.env` (never committed); the adapter reads `process.env.<SERVICE>_API_KEY` at call time.

---

## 6. Sidecar deployment inventory

| Sidecar | Language | Port | Reason |
|---|---|---|---|
| voicebox | Python (FastAPI) | 8000 | MIT — could be embedded but Python; sidecar keeps ALO TypeScript-only |
| sms.domovina.ai Reverse OTP | TypeScript (Bun) | 8090 | AGPL-3.0 — must be separate process |
| httpSMS self-hosted | Go | 8091 | AGPL-3.0 — must be separate process |
| VideoCaptioner | Python | 8092 | GPL-3.0 — must be separate process |
| Remotion render worker | TypeScript | 8093 | Custom license — isolates dependency footprint |
| CogVideo (deferred) | Python | 8094 | Apache-2.0 but Python; GPU box separate |
| CLI-Anything | Python | 8095 | Apache-2.0 but Python; isolates skill registry |

All sidecars run on `127.0.0.1` (loopback) — not exposed to the public internet. The ALO Next.js process is the only public-facing entry point.

---

## Cross-references

- `baseline-audit.md` — existing ALO platform state.
- `repository-audit.md` — per-repo audit with 14 inspection dimensions.
- `architecture.md` — the 12 logical services that consume these adapters.
- `security-review.md` — adapter security, sidecar AGPL implications, child-safety controls.
- `database-design.md` — new Prisma models for adapter state.
- `deployment-guide.md` — sidecar deployment, env vars, rollback.
- `testing-report.md` — adapter health tests, mocked providers for CI.
- `production-readiness.md` — current readiness verdict.

---

## Final note

This integration matrix specifies 8 actionable integrations (2 INTEGRATE, 4 ADAPT, 2 OPTIONAL-pilot) and 11 rejections with documented reasons. Every integration uses the adapter pattern with sidecar deployment for AGPL/GPL/Python repos. The directive's FINAL RULE is reaffirmed: **never blindly clone every project into the production app. Use isolated services and adapters.**
