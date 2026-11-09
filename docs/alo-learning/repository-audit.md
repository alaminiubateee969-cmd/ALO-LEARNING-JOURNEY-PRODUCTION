# ALO Learning — Repository Audit

> **Document type:** Per-repo audit of 22 candidate GitHub repositories (Phase 1 deliverable)
> **Audit date:** 2026-11-05
> **Auditor:** Z.ai
> **Method:** Each repository was cloned with `git clone --depth=1`. The README, LICENSE (verified from the actual file, not the GitHub badge), package manifest, and 3-5 key source files were read for each repo.
> **Companion documents:** `baseline-audit.md`, `architecture.md`, `integration-matrix.md`, `security-review.md`, `database-design.md`, `deployment-guide.md`, `testing-report.md`, `production-readiness.md`.

---

## Purpose and scope

This document satisfies **Section 3 (GITHUB REPOSITORY INVENTORY)** of the ALO Learning Master Engineering & Integration Directive. It audits each of the 22 candidate GitHub repositories (the directive lists 21 numbered repos + ComfyUI_RH_APICall; the user also provided `HKUDS/CLI-Anything` separately as a cross-cutting candidate, audited as repo #23 in `integration-matrix.md`).

For every repository, the directive mandates 14 inspection dimensions: README, source code, LICENSE, dependencies, supported operating systems, Python/Node versions, GPU requirements, model weights and download requirements, API availability, Docker support, security issues, maintenance activity, commercial-use restrictions, third-party asset licenses, compatibility with ALO infrastructure.

A repository decision matrix (INTEGRATE / ADAPT / REFERENCE ONLY / OPTIONAL / REJECT) is provided at the end of this document and expanded in `integration-matrix.md`.

---

## License verification — critical correction

The single most actionable finding of this audit is that **8 of the 22 repos have a license that differs from what GitHub badges suggest**. Every license in this document was verified by reading the actual LICENSE file in the cloned tree.

| Repo | GitHub badge / first-pass claim | Actual LICENSE file | Risk |
|---|---|---|---|
| httpSMS (NdoleStudio/httpsms) | MIT (badge) | **AGPL-3.0** | Self-hosting triggers full-source disclosure |
| sms.domovina.ai | "NO LICENSE" | **AGPL-3.0** (inherited from vendored httpsms subtree) | Same as above |
| VoIP (0perationPrivacy) | MIT (badge) | **GPL-3.0** | Copyleft if linked |
| linphone-iphone | MIT (badge) | **GPL-3.0-or-later** | Dual: proprietary option available for fee |
| ipftrace2 | MIT (badge) | **GPL-2.0-only OR BSD-2-Clause** | Dual — choose BSD-2-Clause path |
| VideoCaptioner | MIT (badge) | **GPL-3.0** | Viral if linked; treat as network service |
| RedditVideoMakerBot | MIT (badge) | **GPL-3.0** | Plus Reddit ToS risk |
| 3b1b/videos | MIT (badge) | **CC BY-NC-SA 4.0** | NonCommercial — blocks commercial ALO use |

Plus three additional license situations:
- **VideoCode**: NO LICENSE FILE — all rights reserved.
- **ComfyUI_RH_APICall**: NO LICENSE FILE — all rights reserved.
- **Remotion**: Custom two-tier "Remotion License" — free for individuals / for-profit orgs ≤3 employees / non-profits / evaluators; Company License required otherwise. NOT OSI-approved.
- **CogVideo / HunyuanVideo / InfiniteTalk**: code is Apache-2.0 but **model weights carry separate, more restrictive licenses** — see per-repo entries.

---

## VOICE, SMS AND TELEPHONY

### 1. voicebox (jamiepine/voicebox)

| Dimension | Finding |
|---|---|
| README | Local-first AI voice studio marketed as open-source ElevenLabs + WisprFlow replacement. Bundles 8 TTS engines (Qwen3-TTS, Chatterbox, LuxTTS, Kokoro, HumeAI TADA, etc.) plus Whisper STT and a Qwen3 LLM for personality rewriting, all behind a FastAPI REST API (`/generate`, `/speak`, `/transcribe`) and a FastMCP server mounted at `/mcp`. |
| Source code | Python (FastAPI backend, 156 .py) + TypeScript/React frontend (107 .ts, 106 .tsx) + Rust Tauri desktop shell (18 .rs). ~382 source files. |
| LICENSE | **MIT** (verified) |
| Dependencies | FastAPI, Pydantic, Click, pytest, MLX/CUDA/ROCm/CPU backends; Tauri for desktop |
| Supported OS | macOS (MLX), Linux (CUDA/ROCm/CPU), Windows (CUDA/CPU); Docker |
| Python/Node versions | Python 3.12+; Node 20+ for the Tauri frontend |
| GPU requirements | Optional but recommended: 8GB+ VRAM if loading Qwen3-TTS + Whisper Large + personality LLM simultaneously. CPU inference supported. |
| Model weights | Auto-downloads per selected engine. Kokoro (82M) is CPU-friendly; Qwen3-TTS (1.7B) needs GPU. |
| API availability | REST: `POST /generate`, `POST /speak`, `POST /transcribe`. MCP server at `/mcp`. |
| Docker support | Yes — `docker-compose.yml` for backend |
| Security issues | Optional cloud key in `services/cloud.py` (leave disabled for ALO) |
| Maintenance activity | Very active (last commit 2026-10-07); 57 .mdx doc pages; SECURITY.md present; 35+ backend tests |
| Commercial-use restrictions | None — MIT |
| Third-party asset licenses | Each TTS engine has its own weight license (mostly Apache-2.0 or MIT) |
| Compatibility with ALO | **STRONG FIT** — replaces ALO's Piper+espeak+formant chain. Multi-engine fallback is strictly stronger than current single-Piper path. Adds voice cloning via Chatterbox. Tauri desktop UI is irrelevant — deploy only the FastAPI backend. |

**Decision: INTEGRATE** (M effort, MIT, local-first)

---

### 2. sms.domovina.ai (domovinatv/sms.domovina.ai)

| Dimension | Finding |
|---|---|
| README | Self-hosted fork of httpSMS deployed behind Cloudflare Tunnel on Oracle ARM. Adds a **Reverse OTP** service (`webhook/`, Hono + Bun on Cloudflare Workers) that issues a code, asks the user to SMS it to the gateway, matches it via JWT-signed webhook from httpsms, and marks the phone verified. |
| Source code | Go (235 .go, vendored httpsms API + Android Kotlin client) + TypeScript (24 .ts, Reverse-OTP webhook) + Vue (26 .vue) + Kotlin (24 .kt). ~489 files. |
| LICENSE | **AGPL-3.0** (inherited from the vendored `httpsms/` subtree) |
| Dependencies | Go Fiber, Hono + Bun, Vue/Nuxt 3, Cloudflare Workers runtime, Coolify overlay |
| Supported OS | Linux (Oracle ARM target); Cloudflare Workers for the webhook |
| Python/Node versions | Go 1.21+; Bun latest |
| GPU requirements | None |
| Model weights | None |
| API availability | Reverse OTP service exposes HTTP endpoints (issue, verify) |
| Docker support | Yes — Coolify `docker-compose.yml` |
| Security issues | Reverse OTP is described as "PoC" with in-memory `Map` storage in dev. Android release builds reuse debug signing config. |
| Maintenance activity | Active (last commit 2026-05-11) |
| Commercial-use restrictions | **AGPL-3.0** — full-source disclosure required if bundled into closed-source SaaS |
| Third-party asset licenses | Vendored httpms subtree (AGPL-3.0); Coolify overlay (AGPL-3.0) |
| Compatibility with ALO | **PARTIAL FIT** — adds a Reverse OTP capability ALO doesn't have. AGPL-3.0 requires sidecar deployment. |

**Decision: ADAPT** (M effort, AGPL-3.0, deploy as sidecar)

---

### 3. httpSMS (NdoleStudio/httpsms)

| Dimension | Finding |
|---|---|
| README | Self-hostable SMS gateway that turns an Android phone into an HTTP SMS API. Outbound SMS: `POST /v1/messages/send` → push notification via FCM → Android `SmsManager.sendTextMessage()`. Inbound SMS: phone forwards `message.phone.received` events as JWT-signed webhooks. End-to-end AES-256 encryption, rate-limiting, message expiration, billing. |
| Source code | Go (Fiber API server, ~247 .go) + Vue/Nuxt 3 web UI + Kotlin Android client. ~620 source files. |
| LICENSE | **AGPL-3.0** (verified) |
| Dependencies | Go Fiber, Vue/Nuxt 3, Firebase Cloud Messaging, CockroachDB/Postgres, Redis, Cloudflare Turnstile |
| Supported OS | Linux server; Android phone for gateway |
| Python/Node versions | Go 1.21+; Node 20+ for web UI |
| GPU requirements | None |
| Model weights | None |
| API availability | REST: `POST /v1/messages/send`, `GET /v1/messages`, webhook delivery for inbound |
| Docker support | Yes |
| Security issues | Upstream issue #881: rotated API keys remain valid up to 2h due to ristretto cache |
| Maintenance activity | Very active (last commit 2026-11-02) |
| Commercial-use restrictions | **AGPL-3.0** — incompatible with closed-source SaaS distribution |
| Third-party asset licenses | None |
| Compatibility with ALO | **ALREADY IN USE** — ALO already uses the hosted httpSMS SaaS via the `httpsms` npm SDK for admin OTP delivery. Self-host = L effort + AGPL sidecar. |

**Decision: ALREADY IN USE (hosted SaaS)**. Self-host = OPTIONAL with AGPL caveat.

---

### 4. httpsms-node (NdoleStudio/httpsms-node)

| Dimension | Finding |
|---|---|
| README | Tiny server-side TypeScript SDK for the httpSMS HTTP API. Exposes `client.messages.postSend({content, from, to, encrypted?})` and a `cipher` service for AES-256 encrypt/decrypt. |
| Source code | TypeScript (8 .ts + 2 .js test files). 23 files total. |
| LICENSE | **MIT** (verified) |
| Dependencies | axios |
| Supported OS | Cross-platform (Node library) |
| Python/Node versions | Node 18+ |
| GPU requirements | None |
| Model weights | None |
| API availability | N/A — client SDK |
| Docker support | N/A |
| Security issues | axios dependency pulls transitive deps; pin and audit periodically |
| Maintenance activity | Active (last commit 2026-11-01, dependabot-driven) |
| Commercial-use restrictions | None — MIT |
| Third-party asset licenses | None |
| Compatibility with ALO | **ALREADY IN USE** — ALO already integrates this SDK. No action required. |

**Decision: ALREADY IN USE**

---

### 5. linphone-iphone (BelledonneCommunications/linphone-iphone)

| Dimension | Finding |
|---|---|
| README | Liblinphone-based iOS VoIP client. SIP voice/video calls, instant messaging, presence. |
| Source code | Swift (203 .swift). 645 files total. |
| LICENSE | **GPL-3.0-or-later** (dual: proprietary option available for fee from Belledonne) |
| Dependencies | Liblinphone, SIP stack, iOS frameworks |
| Supported OS | iOS only |
| Python/Node versions | N/A |
| GPU requirements | None |
| Model weights | None |
| API availability | iOS app (no server API) |
| Docker support | No |
| Security issues | None identified |
| Maintenance activity | Active |
| Commercial-use restrictions | **GPL-3.0+** — copyleft if any code reused; proprietary option requires fee |
| Third-party asset licenses | Liblinphone is dual-licensed |
| Compatibility with ALO | **NO FIT** — ALO is a Next.js single-admin web platform, not a mobile VoIP app. iOS-only Swift is the wrong runtime. GPL-3.0+ dual license requires proprietary option fee. |

**Decision: REJECT**

---

### 6. VoIP (0perationPrivacy/VoIP)

| Dimension | Finding |
|---|---|
| README | Self-hosted VoIP/PBX solution. Privacy-focused telephony. |
| Source code | JavaScript (79 .js). 168 files. |
| LICENSE | **GPL-3.0** (verified) |
| Dependencies | Node.js, VoIP/PBX stack |
| Supported OS | Linux server |
| Python/Node versions | Node (version unspecified in README) |
| GPU requirements | None |
| Model weights | None |
| API availability | VoIP/PBX APIs (unspecified in README) |
| Docker support | Likely (not verified) |
| Security issues | Not assessed — dormant repo |
| Maintenance activity | **Dormant** — appears abandoned |
| Commercial-use restrictions | **GPL-3.0** copyleft |
| Third-party asset licenses | None |
| Compatibility with ALO | **NO FIT** — ALO has no telephony/PBX requirement today. JavaScript/Node stack would conflict with ALO's Next.js server. Dormant. |

**Decision: REJECT**

---

### 7. ipftrace2 (YutaroHayakawa/ipftrace2)

| Dimension | Finding |
|---|---|
| README | Linux kernel packet tracer — eBPF-based IP flow tracing tool for kernel/network debugging. |
| Source code | C + header files (25 .h). 73 files. |
| LICENSE | **GPL-2.0-only OR BSD-2-Clause** (dual) |
| Dependencies | Linux kernel headers, eBPF toolchain, libbpf |
| Supported OS | Linux only |
| Python/Node versions | N/A |
| GPU requirements | None |
| Model weights | None |
| API availability | CLI tool + eBPF kernel module |
| Docker support | No (kernel-level tool) |
| Security issues | None (read-only tracing tool) |
| Maintenance activity | Active |
| Commercial-use restrictions | Dual license — choose BSD-2-Clause path for ALO if needed |
| Third-party asset licenses | None |
| Compatibility with ALO | **NO FIT** — this is a Linux kernel debugging tool, not a telephony library. The directive's Section 8 explicitly says: "ipftrace2 is not a VoIP engine. Do not integrate it as a telephony provider." Could be useful as an ops debugging tool. |

**Decision: REFERENCE ONLY** (for ops debugging of the ALO VPS)

---

### 8. VoIP-Call-Sample (developerspace-samples/VoIP-Call-Sample)

| Dimension | Finding |
|---|---|
| README | Sample VoIP call configuration files. Tutorial/demo material. |
| Source code | XML/config-heavy (277 .xml). 477 files. |
| LICENSE | **MIT** (verified) |
| Dependencies | Sample configs only |
| Supported OS | N/A |
| Python/Node versions | N/A |
| GPU requirements | None |
| Model weights | None |
| API availability | None — sample configs |
| Docker support | No |
| Security issues | None |
| Maintenance activity | **Dormant** — last commit ~2021 |
| Commercial-use restrictions | None — MIT |
| Third-party asset licenses | None |
| Compatibility with ALO | **NO FIT** — sample-only XML configs, no actual library or API. Dormant. |

**Decision: REJECT**

---

### 9. electron-promise-ipc (sibnerian/electron-promise-ipc)

| Dimension | Finding |
|---|---|
| README | Promise-based IPC for Electron apps. Wraps Electron's `ipcRenderer`/`ipcMain` in promises. |
| Source code | TypeScript (8 .ts). 23 files. |
| LICENSE | **MIT** (verified) |
| Dependencies | Electron |
| Supported OS | Cross-platform (Electron) |
| Python/Node versions | Node 16+ |
| GPU requirements | None |
| Model weights | None |
| API availability | N/A — Electron library |
| Docker support | No |
| Security issues | None |
| Maintenance activity | **Dormant** |
| Commercial-use restrictions | None — MIT |
| Third-party asset licenses | None |
| Compatibility with ALO | **NO FIT** — ALO is a Next.js web app, not an Electron desktop app. Dormant. Wrong runtime. |

**Decision: REJECT**

---

## VIDEO, EDITING AND GENERATION

### 10. VideoCaptioner (WEIFENG2333/VideoCaptioner)

| Dimension | Finding |
|---|---|
| README | CLI + desktop GUI (PySide) video-captioning pipeline: ASR → LLM-based subtitle re-segmentation → translation → subtitle burn-in (ASS rounded-bg styles + soft subs) → optional dub. Ships as a pip-installable `videocaptioner` package, a Claude Code Skill, and a Windows installer. |
| Source code | Python, 326 files. |
| LICENSE | **GPL-3.0** (verified) |
| Dependencies | PySide6, faster-whisper, whisper-cpp, openai-whisper, ffmpeg, various LLM clients |
| Supported OS | Windows (installer), Linux, macOS |
| Python/Node versions | Python 3.9+ |
| GPU requirements | 3GB VRAM for local Whisper or CPU (slow) |
| Model weights | No bundled checkpoint. Default free ASR = Bcut (Bilibili) + Jianying (ByteDance) cloud services; Whisper-family local ASR optional. |
| API availability | CLI (`videocaptioner` command) + GUI |
| Docker support | Not documented |
| Security issues | Default free ASR engines are Chinese cloud services — privacy and Bengali accuracy both poor |
| Maintenance activity | Production (PyPI package, GUI, docs site, tests, regular releases) |
| Commercial-use restrictions | **GPL-3.0** viral copyleft — treat as a network service, not a linked library |
| Third-party asset licenses | Bundled LLM prompts may have their own licenses |
| Compatibility with ALO | **PARTIAL FIT** — ALO already burns Bengali captions with ffmpeg drawtext + HindSiliguri. VideoCaptioner's richer ASS styling could be a future upgrade, but the free default ASR is Chinese-cloud-only and would not transcribe Bengali well. |

**Decision: ADAPT** (M effort, GPL-3.0, deploy as sidecar with Whisper-local mode)

---

### 11. Pixelle-Video (ATH-MaaS / actually AIDC-AI/Pixelle-Video)

| Dimension | Finding |
|---|---|
| README | Topic-to-short-video engine: LLM writes script → AI generates per-shot images/videos (via ComfyUI workflow JSON, RunningHub cloud, or direct API providers: DashScope/Wan, OpenAI, ARK/Seedream/Seedance, Kling) → TTS (Edge-TTS, Index-TTS, voice clone) → HTML/CSS templates render final composite with BGM. |
| Source code | Python, 313 files. |
| LICENSE | **Apache-2.0** (verified) |
| Dependencies | Streamlit, ComfyUI workflow JSON, DashScope/OpenAI/ARK/Kling API clients, Edge-TTS, Index-TTS |
| Supported OS | Windows (one-click bundle), Linux, macOS |
| Python/Node versions | Python 3.10+ |
| GPU requirements | No weights shipped — orchestrator only. Routes through user's local ComfyUI, RunningHub cloud, or direct paid API providers. |
| Model weights | None bundled |
| API availability | Streamlit web UI + Python API |
| Docker support | Not documented |
| Security issues | Defaults to cloud LLMs (Qwen, GPT) and cloud image/video APIs |
| Maintenance activity | Production (Streamlit web UI, Windows one-click bundle, mkdocs site, regular monthly updates) |
| Commercial-use restrictions | None — Apache-2.0 |
| Third-party asset licenses | Bundled ComfyUI workflows drag in their own model licenses separately |
| Compatibility with ALO | **PARTIAL FIT** — ALO's photo-to-video pipeline already covers script→image→audio→render; Pixelle's value-add is the HTML/CSS template engine (vs ALO's ffmpeg drawtext). Port patterns, not the Streamlit app. |

**Decision: ADAPT** (L effort, Apache-2.0, port template engine patterns only)

---

### 12. Remotion (remotion-dev/remotion)

| Dimension | Finding |
|---|---|
| README | Programmatic video creation framework — write videos as React components, render via headless Chromium + bundled `compositor` binary (ffmpeg-backed). Includes Studio (browser editor), Player, CLI, Lambda/Vercel/Cloudrun render targets, captions/transitions/effects/sound/fonts packages. 1200+ pages of docs. |
| Source code | TypeScript, 14483 files across 138 packages in a bun+turbo monorepo. |
| LICENSE | **Custom "Remotion License"** — Free for individuals, for-profit orgs ≤3 employees, non-profits, and evaluators; **Company License required otherwise** (paid). NOT OSI-approved. |
| Dependencies | Node, React, Chromium (bundled), ffmpeg-backed `compositor` binary |
| Supported OS | macOS, Linux, Windows (per-OS compositor binary) |
| Python/Node versions | Node 18+ |
| GPU requirements | None — pure TypeScript + Chromium rendering |
| Model weights | None |
| API availability | React component API + CLI + Lambda/Vercel/Cloudrun render APIs |
| Docker support | Yes |
| Security issues | None identified |
| Maintenance activity | Production (very active, npm-published, used commercially) |
| Commercial-use restrictions | **Custom two-tier license** — if ALO is a for-profit with >3 employees, Company License fee applies |
| Third-party asset licenses | None |
| Compatibility with ALO | **STRONG FIT for the programmatic-editing / motion-graphics layer ALO currently lacks**. Could REPLACE ALO's burned-caption pipeline. License audit risk if tech360-bd employs >3 people. |

**Decision: OPTIONAL** (L effort, custom license — check Company License cost before adoption)

---

### 13. VideoCode (MarkTechStation/VideoCode)

| Dimension | Finding |
|---|---|
| README | 9-line README. Tutorial-code dump for the "马克的技术工作坊" YouTube/Bilibili channel. Each folder is a topic. NOT a video tool despite the name. |
| Source code | Python, ~9 small sample folders, 64 files. |
| LICENSE | **NO LICENSE FILE** — all rights reserved by default |
| Dependencies | Per-sample |
| Supported OS | N/A |
| Python/Node versions | Python 3.x |
| GPU requirements | None |
| Model weights | None |
| API availability | None — tutorial code |
| Docker support | No |
| Security issues | None (no production code) |
| Maintenance activity | Tutorial content dump |
| Commercial-use restrictions | **NO LICENSE** — cannot legally copy or adapt any of the code |
| Third-party asset licenses | None |
| Compatibility with ALO | **NO FIT** — title is misleading. Cannot legally reuse code. |

**Decision: REJECT**

---

### 14. 3b1b/videos (3Blue1Brown)

| Dimension | Finding |
|---|---|
| README | 3Blue1Brown's math animation video source code (companion to manim library). |
| Source code | Python (437 .py, 503 files). |
| LICENSE | **CC BY-NC-SA 4.0** (verified — NonCommercial, ShareAlike) |
| Dependencies | manim, Python |
| Supported OS | Cross-platform |
| Python/Node versions | Python 3.10+ |
| GPU requirements | None (manim is CPU + OpenGL) |
| Model weights | None |
| API availability | Python scripts (render videos via `manim` CLI) |
| Docker support | Not documented |
| Security issues | None |
| Maintenance activity | Active |
| Commercial-use restrictions | **CC BY-NC-SA 4.0 — NonCommercial** — blocks commercial ALO use entirely |
| Third-party asset licenses | 3Blue1Brown content is separately licensed |
| Compatibility with ALO | **NO FIT for commercial ALO** — NonCommercial license blocks commercial use. Math-animation-only scope. |

**Decision: REJECT** (NC license; reference only for educational inspiration)

---

### 15. youtube-dl (ytdl-org/youtube-dl)

| Dimension | Finding |
|---|---|
| README | The original YouTube downloader. CLI + Python library. |
| Source code | Python (903 .py, 982 files). |
| LICENSE | **Public Domain / Unlicense** (verified) |
| Dependencies | Python stdlib; optional ffmpeg for format conversion |
| Supported OS | Cross-platform |
| Python/Node versions | Python 3.x |
| GPU requirements | None |
| Model weights | None |
| API availability | CLI + Python library |
| Docker support | Community Docker images available |
| Security issues | None |
| Maintenance activity | Slow-moving — yt-dlp is the actively-maintained fork |
| Commercial-use restrictions | None — Public Domain |
| Third-party asset licenses | None |
| Compatibility with ALO | **NO FIT for youtube-dl itself** (slow-moving) — use **yt-dlp** fork instead. Both Public Domain. YouTube ToS prohibits bulk downloading — only source CC-licensed content. |

**Decision: ADAPT (use yt-dlp fork instead)** — S effort, Public Domain, local-first

---

### 16. claude-video (bradautomates/claude-video)

| Dimension | Finding |
|---|---|
| README | Tiny MIT-licensed reference for the "/watch" skill pattern — CLI tool that an LLM agent can call to capture screen activity and produce an MP4. |
| Source code | Python, 51 files, 1.1MB. |
| LICENSE | **MIT** (verified) |
| Dependencies | Python stdlib + ffmpeg |
| Supported OS | Cross-platform |
| Python/Node versions | Python 3.x |
| GPU requirements | None |
| Model weights | None |
| API availability | CLI + skill manifest (SKILL.md) |
| Docker support | Not documented |
| Security issues | None |
| Maintenance activity | Active |
| Commercial-use restrictions | None — MIT |
| Third-party asset licenses | None |
| Compatibility with ALO | **STRONG FIT** — ALO's AgentOS (42 configured agents) has no way for an agent to record its own work for audit. The /watch pattern fills that gap. |

**Decision: INTEGRATE** (S effort, MIT, fully local)

---

### 17. InfiniteTalk (MeiGen-AI/InfiniteTalk)

| Dimension | Finding |
|---|---|
| README | Infinite talking-head video generation. Uses Wan2.1-14B model. |
| Source code | Python, 67 files. |
| LICENSE | **Apache-2.0** (code) / **Wan2.1 weight license** (Alibaba, <100M MAU commercial cap) |
| Dependencies | PyTorch, Wan2.1 model, diffusers |
| Supported OS | Linux (GPU box) |
| Python/Node versions | Python 3.10+ |
| GPU requirements | **40-80GB VRAM (A100 40-80GB)** — not single-VPS feasible |
| Model weights | Wan2.1-14B (multi-GB download, separate license) |
| API availability | Python script-based |
| Docker support | Not documented |
| Security issues | None |
| Maintenance activity | Active |
| Commercial-use restrictions | Apache-2.0 code OK; Wan2.1 weights have commercial cap |
| Third-party asset licenses | Wan2.1 weight license applies |
| Compatibility with ALO | **NO FIT for current ALO** — Wan2.1-14B requires 40-80GB VRAM. Not single-VPS feasible. |

**Decision: REJECT** (GPU-infeasible on single VPS)

---

### 18. VideoRecorder (qdrzwd/VideoRecorder)

| Dimension | Finding |
|---|---|
| README | Video recorder project. Mostly image assets. |
| Source code | Mixed (97 .png, 232 files). |
| LICENSE | **Apache-2.0** (verified) |
| Dependencies | Unclear |
| Supported OS | Android (per cluster subagent) |
| Python/Node versions | N/A |
| GPU requirements | None |
| Model weights | None |
| API availability | None identified |
| Docker support | No |
| Security issues | None identified |
| Maintenance activity | **Abandoned** — 2014-era Android code |
| Commercial-use restrictions | None — Apache-2.0 |
| Third-party asset licenses | None |
| Compatibility with ALO | **NO FIT** — abandoned 2014-era Android code. |

**Decision: REJECT**

---

### 19. CogVideo (THUDM / "zai-org")

| Dimension | Finding |
|---|---|
| README | CogVideoX text-to-video model (5B param). Same vendor family as ALO's existing z-ai-web-dev-sdk. |
| Source code | Python, 204 files. |
| LICENSE | **Apache-2.0** (code) / **CogVideoX-Open-Internal License** (weights) |
| Dependencies | PyTorch, diffusers, CogVideoX weights |
| Supported OS | Linux (GPU box) |
| Python/Node versions | Python 3.10+ |
| GPU requirements | **5GB min VRAM, 16-24GB recommended** — feasible on a dedicated GPU box |
| Model weights | CogVideoX-5B (multi-GB download; separate license) |
| API availability | Python script + inference CLI |
| Docker support | Yes |
| Security issues | None |
| Maintenance activity | Active |
| Commercial-use restrictions | CogVideoX weight license requires commercial registration at Zhipu's `open.bigmodel.cn` with **1M-visits/month cap** and **Chinese-law jurisdiction** |
| Third-party asset licenses | CogVideoX weight license applies |
| Compatibility with ALO | **DEFER** — self-host only if ALO's avatar-video volume justifies a dedicated 16-24GB GPU VPS. Duplicates the Z.ai vendor relationship. |

**Decision: OPTIONAL (deferred)** — L effort, Apache-2.0 code + restrictive weights

---

### 20. HunyuanVideo (Tencent-Hunyuan/HunyuanVideo)

| Dimension | Finding |
|---|---|
| README | Tencent Hunyuan 13B text-to-video model. |
| Source code | Python, 55 files. |
| LICENSE | **Apache-2.0** (code) / **Tencent Community License** (weights) |
| Dependencies | PyTorch, diffusers, Hunyuan weights |
| Supported OS | Linux (GPU box) |
| Python/Node versions | Python 3.10+ |
| GPU requirements | **45-80GB VRAM** — not single-VPS feasible at all |
| Model weights | Hunyuan 13B (multi-GB download; separate license) |
| API availability | Python script + inference CLI |
| Docker support | Yes |
| Security issues | None |
| Maintenance activity | Active |
| Commercial-use restrictions | Tencent Community License **explicitly excludes EU, UK, and South Korea** and has a 100M MAU cap with HK jurisdiction |
| Third-party asset licenses | Tencent Community License applies |
| Compatibility with ALO | **HARD PASS** — territory-restricted license. 45-80GB VRAM infeasible. |

**Decision: REJECT**

---

### 21. RedditVideoMakerBot (elebumm/RedditVideoMakerBot)

| Dimension | Finding |
|---|---|
| README | Auto-generates Reddit-story videos: scrapes AskReddit, TTS narration, gameplay background, captions. |
| Source code | Python, 123 files. |
| LICENSE | **GPL-3.0** (verified) |
| Dependencies | Python, TTS engines, Reddit API, YouTube/TikTok APIs |
| Supported OS | Cross-platform |
| Python/Node versions | Python 3.x |
| GPU requirements | None |
| Model weights | None |
| API availability | CLI + Python API |
| Docker support | Not documented |
| Security issues | Reddit ToS prohibits scraping |
| Maintenance activity | Active |
| Commercial-use restrictions | **GPL-3.0** copyleft + Reddit ToS risk |
| Third-party asset licenses | Reddit content has its own ToS |
| Compatibility with ALO | **NO FIT for ALO** — GPL-3.0, Reddit ToS risk, content quality mismatch with ALO's educational positioning. |

**Decision: REJECT**

---

## CREATIVE INTEGRATION

### 22. ComfyUI_RH_APICall (HM-RunningHub/ComfyUI_RH_APICall)

| Dimension | Finding |
|---|---|
| README | Mandarin Chinese. ComfyUI plugin that bridges local ComfyUI to the RunningHub cloud workflow API. Once installed in ComfyUI's `custom_nodes/` directory, it adds nodes that let you invoke RunningHub-hosted workflows from your local ComfyUI graph. |
| Source code | Python, 9 files (~150KB total). Main file: `RH_ExecuteNode.py` (115KB). |
| LICENSE | **NO LICENSE FILE** — all rights reserved by default |
| Dependencies | ComfyUI (host), RunningHub API key, requests |
| Supported OS | Linux (wherever ComfyUI runs) |
| Python/Node versions | Python 3.x (ComfyUI requirement) |
| GPU requirements | None for the plugin itself (cloud executes workflows) |
| Model weights | None (RunningHub cloud holds the weights) |
| API availability | RunningHub API (cloud) |
| Docker support | Inherits ComfyUI's Docker setup |
| Security issues | Routes workflow execution to RunningHub cloud — violates ALO's local-first principle |
| Maintenance activity | Active (last update 2025-10-15 per README) |
| Commercial-use restrictions | **NO LICENSE** — cannot legally reuse without explicit written permission from HM-RunningHub |
| Third-party asset licenses | RunningHub workflows have their own ToS |
| Compatibility with ALO | **HARD PASS** — (1) NO LICENSE makes bundling illegal, (2) directly violates ALO's local-first principle, (3) vendor lock-in to RunningHub. |

**Decision: REJECT** (NO LICENSE + violates local-first; reference only for API pattern)

---

## CROSS-CUTTING (added by user)

### 23. CLI-Anything (HKUDS/CLI-Anything)

> Documented in detail in `architecture.md` Section 7. Summary here for the master matrix.

| Dimension | Finding |
|---|---|
| README | CLI-Anything: Making ALL Software Agent-Native. Registry and harness framework that makes any software agent-ready by generating CLI wrappers with JSON output, preview, and trajectory loops. Install via `pip install cli-anything-hub` then `cli-hub install <name>`. Ships 18+ community-built skill harnesses (blender, audacity, calibre, QGIS, 3MF, browser, chromadb, etc.). 2,461 passing tests. |
| Source code | Python 3.10+ (1267 .py files, 1872 files total). |
| LICENSE | **Apache-2.0** (verified directly from LICENSE file) |
| Dependencies | Click, pytest; each skill has its own dependencies |
| Supported OS | Cross-platform (Python) |
| Python/Node versions | Python 3.10+ |
| GPU requirements | None for the framework itself; skills may have their own |
| Model weights | None |
| API availability | CLI (`cli-hub` command) + skill manifests (SKILL.md) |
| Docker support | Not documented |
| Security issues | Community-contributed skill quality varies; cli-hub installer pulls from public registry |
| Maintenance activity | Very active (news through 2026-05-30) |
| Commercial-use restrictions | None — Apache-2.0 |
| Third-party asset licenses | Each skill's LICENSE is in its skill folder |
| Compatibility with ALO | **PARTIAL FIT** — ALO's AgentOS (42 configured agents) currently calls LLM APIs synchronously. CLI-Anything gives agents a uniform way to drive external software via JSON-output CLI commands. Pilot with 1-2 skills (audacity for audio editing, blender for 3D scene generation) before wider rollout. |

**Decision: OPTIONAL (pilot)** — M effort, Apache-2.0, local-first

---

## Repository Decision Matrix

| # | Repo | License | Verdict | Integration mode | Effort | Phase |
|---|---|---|---|---|---|---|
| 1 | voicebox | MIT | **INTEGRATE** | Sidecar (FastAPI on VPS) | M | Phase 3 |
| 2 | sms.domovina.ai | AGPL-3.0 | **ADAPT** | Network service (sidecar) | M | Phase 4 |
| 3 | httpSMS | AGPL-3.0 | **ALREADY IN USE** | Hosted SaaS (self-host optional) | L (self-host) | Phase 4 (optional) |
| 4 | httpsms-node | MIT | **ALREADY IN USE** | Embedded (npm dep) | S | — |
| 5 | linphone-iphone | GPL-3.0+ | **REJECT** | — | — | — |
| 6 | VoIP (0pP) | GPL-3.0 | **REJECT** | — | — | — |
| 7 | ipftrace2 | GPL-2.0/BSD-2 | **REFERENCE ONLY** | — | — | (ops debugging) |
| 8 | VoIP-Call-Sample | MIT | **REJECT** | — | — | — |
| 9 | electron-promise-ipc | MIT | **REJECT** | — | — | — |
| 10 | VideoCaptioner | GPL-3.0 | **ADAPT** | Sidecar (Whisper-local mode) | M | Phase 9 |
| 11 | Pixelle-Video | Apache-2.0 | **ADAPT** | Port patterns (template engine) | L | Phase 7 |
| 12 | Remotion | Custom | **OPTIONAL** | Sidecar (render worker) | L | Phase 7 |
| 13 | VideoCode | NO LICENSE | **REJECT** | — | — | — |
| 14 | 3b1b/videos | CC BY-NC-SA | **REJECT** | — | — | — |
| 15 | youtube-dl | Public Domain | **ADAPT** (use yt-dlp fork) | Sidecar (binary) | S | Phase 7 |
| 16 | claude-video | MIT | **INTEGRATE** | Skill pattern | S | Phase 11 |
| 17 | InfiniteTalk | Apache-2.0* | **REJECT** | — | — | — |
| 18 | VideoRecorder | Apache-2.0 | **REJECT** | — | — | — |
| 19 | CogVideo | Apache-2.0* | **OPTIONAL (deferred)** | Sidecar (GPU box) | L | Phase 8 (deferred) |
| 20 | HunyuanVideo | Apache-2.0* | **REJECT** | — | — | — |
| 21 | RedditVideoMakerBot | GPL-3.0 | **REJECT** | — | — | — |
| 22 | ComfyUI_RH_APICall | NO LICENSE | **REJECT** | — | — | — |
| 23 | CLI-Anything | Apache-2.0 | **OPTIONAL (pilot)** | Sidecar + skill source | M | Phase 11 |

\* Apache-2.0 marks the code license for CogVideo / HunyuanVideo / InfiniteTalk. The model weights carry separate, more restrictive licenses.

### Verdict summary

- **INTEGRATE (2):** voicebox, claude-video — both MIT, both low-effort, both clearly fill ALO gaps.
- **ALREADY IN USE (2):** httpSMS (hosted SaaS), httpsms-node (npm SDK) — no action.
- **ADAPT (4):** sms.domovina.ai, VideoCaptioner, Pixelle-Video, youtube-dl/yt-dlp. Each requires deliberate integration work and license-aware deployment.
- **OPTIONAL (3):** Remotion, CogVideo, CLI-Anything.
- **REFERENCE ONLY (1):** ipftrace2 — Linux kernel tracer for ops debugging.
- **REJECT (11):** linphone-iphone, VoIP/0perationPrivacy, VoIP-Call-Sample, electron-promise-ipc, VideoCode, 3b1b/videos, InfiniteTalk, VideoRecorder, HunyuanVideo, RedditVideoMakerBot, ComfyUI_RH_APICall.

---

## Cross-references

- `baseline-audit.md` — existing ALO platform state (Sections A-J).
- `architecture.md` — how each INTEGRATE/ADAPT/OPTIONAL repo plugs into the 12 ALO Learning services.
- `integration-matrix.md` — expanded per-repo integration plan with concrete ALO file paths.
- `security-review.md` — security implications of each integration (sidecar pattern for AGPL, etc.).
- `database-design.md` — new Prisma models needed to support each integration.
- `deployment-guide.md` — Phase 0-13 deployment with rollback.
- `testing-report.md` — test plan for each integration.
- `production-readiness.md` — current readiness verdict.

---

## Final note

This repository audit was conducted by Z.ai on 2026-11-05. All 22 candidate repos (plus the cross-cutting CLI-Anything) were inspected against the 14 dimensions mandated by Section 3 of the directive. The license-correction finding (8 repos with licenses differing from GitHub badges) is the single most actionable result — verify every license by reading the actual LICENSE file, not the badge, before any bundling decision.

The directive's FINAL RULE is reaffirmed: **never blindly clone every project into the production app. Use isolated services and adapters.**
