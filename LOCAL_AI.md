# Local AI and media generation — source behavior and limitations

> Earlier sandbox reports dated 2026-10-17 described media pipeline executions.
> Those executions were not repeated in the current repair pass and do not
> verify production models, providers, hardware, quality, or billing.

## Provider boundary (source inspection)

The inspected media adapters target private Ollama and ComfyUI endpoints; the
local endpoint guard rejects public hosts. Missing local models use explicitly
marked template/placeholder fallbacks rather than silently switching to a
cloud provider. This is a source-level boundary, not live provider or billing
verification. No hosted AI API key is required by those paths, but non-AI
services such as SMS may require separately configured credentials.

**Prior sandbox evidence (historical, not rerun in this audit):** earlier work
reported end-to-end generation attempts with no paid AI APIs and local output
files. Treat the table below as historical test output only, not a guarantee of
current runtime or production availability.

| Pipeline | Provider chain | Verified output |
|---|---|---|
| Image | `comfyui-local` (sharp editorial fallback) | 1024×1024 PNG in `public/generated/` |
| Voice | `espeak-local` | WAV narration in `storage/audio/` |
| Music | `ollama-local` lyrics + `local-procedural-synth` | Bengali lyrics + instrumental WAV in `storage/audio/` |
| Video | `espeak-local` + procedural instrumental + FFmpeg | 1080×1920 H.264+AAC MP4 + Bengali SRT in `storage/videos/` |
| Cinematic | `ollama-local` script + scene stills + FFmpeg | H.264 MP4 + SRT, 3-scene render |

`GET /api/ai/local-status` reports local model/binary availability from configuration and includes a static `noPaidApis` note; it does not measure provider billing or independently prove that a configured service is local. The inspected media adapter calls are to private Ollama/ComfyUI URLs guarded by `getPrivateLocalBaseUrl`. This statement is source-level only. SMS OTP is a separate external service and may require `HTTPSMS_API_KEY`; the optional Inkbox adapter is also separate. Neither integration is AI-provider verification.

## Optional direct external free providers — off by default

A minimal direct adapter (`src/lib/external-ai.ts`) calls a small hardcoded
registry of OpenAI-compatible free-tier providers directly — Groq, LLM7,
OpenCode Zen, and OpenRouter — as a fallback when the local Ollama model is
unavailable. This is deliberately **not** a gateway/router service (no
OmniRoute, no running catalog, no cookie/OAuth-session reuse, no credential
store beyond env keys):

| Provider | Endpoint (hardcoded) | Free key | Default model | Free-only guard |
|---|---|---|---|---|
| Groq | `api.groq.com/openai/v1/chat/completions` | console.groq.com | `llama-3.3-70b-versatile` | no-billing key spends free quota only |
| LLM7 | `api.llm7.io/v1/chat/completions` | token.llm7.io | `default` | `pro` selector blocked (paid) |
| OpenCode Zen | `opencode.ai/zen/v1/chat/completions` | opencode.ai/auth | `big-pickle` | only `big-pickle` / `*-free` models |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | openrouter.ai/settings/keys | `openrouter/free` | only `openrouter/free` / `*:free` models |
| OmniRoute (yours) | `127.0.0.1:20128/v1` (env: `OMNIROUTE_BASE_URL`) | your OmniRoute dashboard | `auto` | owner-gateway — routes per your OmniRoute config |
| Custom gateway | your `baseUrl` + `/chat/completions` | your gateway | your model | owner-gateway — you vouch for it |

- **Fail-closed:** runs only when `ALO_PAID_AI_API_ALLOWED=true` **and**
  `ALO_OWNER_APPROVED_PAID_AI_API=true` **and** at least one provider key is
  set. Defaults are all off, so a fresh deploy makes zero external AI calls.
- **Chain:** configured providers are tried in `ALO_EXTERNAL_AI_PROVIDERS`
  order (default: direct free providers first, scarcest quota last, then
  owner gateways — OmniRoute, then custom providers in JSON order);
  the first success wins and is labelled `<provider>:<model>` in results.
- **Allowlist (code-enforced in `src/lib/ai.ts`):** only non-personal,
  topic-driven content drafts — `generateIdeas`, `generateContentPackage`,
  `scoreContentOpportunity`, `generateHookVariants`, `generateContentBrief`.
  Comments, protective review, command parsing, narration/song/email drafts
  (writer→critic→finalist pipeline), images, voice, and video stay local-only.
- **Guards:** built-in endpoints are not env-configurable, model names must
  match a strict pattern plus the per-provider free-only guard above,
  prompts are capped at 24,000 chars, and provider error bodies / API keys
  are never returned or logged. Gateway endpoints are the exception — see
  the owner-gateway rules below.
- **Data rule:** never enable this for student, family, comment, OTP, or
  admissions data. Drafts still require human review. Free model catalogs
  rotate often (especially OpenRouter `:free` and Zen `*-free`) — if a model
  disappears, set the provider's `*_MODEL` env to a current free ID from the
  provider's live model list; each provider's pricing, limits, retention,
  and terms are the operator's responsibility to re-check.
- **Setup (owner only):** set any subset of `GROQ_API_KEY`, `LLM7_API_KEY`,
  `OPENCODE_API_KEY`, `OPENROUTER_API_KEY` (each optionally with its
  `*_MODEL`), set both switches to `true`, and optionally order providers
  with `ALO_EXTERNAL_AI_PROVIDERS`. `GET /api/ai/local-status` reports
  `external: { enabled, configured, order, providers[] }` (never any key).
  Remove a key, or set either switch to `false`, to disable instantly.

### Adding a provider like OmniRoute (owner gateways)

Two ways, both **server-env only** — the dashboard/API can never add one:

1. **OmniRoute (first-class):** run OmniRoute yourself (e.g.
   `docker run … diegosouzapw/omniroute`, dashboard at
   `http://127.0.0.1:20128`), create an API key in its dashboard, then set
   `OMNIROUTE_API_KEY=…` (optionally `OMNIROUTE_MODEL=auto` or a specific
   model, and `OMNIROUTE_BASE_URL` if it is not local). It joins the chain
   after the direct providers; put it first with
   `ALO_EXTERNAL_AI_PROVIDERS=omniroute,groq,…` if you prefer it.
2. **Any OpenAI-compatible gateway:** declare up to 5 in one env var —
   `ALO_CUSTOM_AI_PROVIDERS_JSON=[{"id":"my-gateway","baseUrl":"https://llm.example.com/v1","apiKeyEnv":"MY_GATEWAY_API_KEY","model":"best-free"}]`
   — then set `MY_GATEWAY_API_KEY=…`. The `id` is yours to choose
   (lowercase letters/digits/dashes), and the custom provider joins the
   chain under that id.

Gateway guards: plain `http` is accepted **only** for loopback/private
hosts (public gateways must be `https`); URLs with embedded credentials,
queries, or fragments are rejected; literal keys inside the JSON are
rejected (env-name references only); malformed entries are skipped, never
fatal. ⚠️ **Trust warning:** a gateway routes onward to whatever *its*
operator configured — ALO cannot verify a gateway stays free, keeps data
in any jurisdiction, or honours any retention promise. Only add gateways
you operate or fully trust, keep them on the same non-personal allowlist,
and remember the draft outputs still require human review.

## Text and Bengali copy

1. Install Ollama on the application machine or an isolated private-network host.
2. Pull a local instruction model appropriate for Bengali (the example default is `qwen2.5:7b`; choose a model whose license and quality meet your use case).
3. Configure:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
```

Docker deployments may use a private Compose service name such as `http://ollama:11434`. Public endpoints are blocked by the application adapter. When Ollama is offline or the selected model is not installed, generated-copy APIs return a marked local template fallback; the fallback is not an LLM output.

## Image generation

1. Install ComfyUI locally, expose its API only on loopback/private networking, and install a compatible checkpoint in `ComfyUI/models/checkpoints`.
2. Set the checkpoint's installed filename exactly:

```dotenv
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_CHECKPOINT=your-local-checkpoint.safetensors
```

The adapter submits a basic checkpoint / text-encode / sampler / save-image graph to ComfyUI's local API. It does not call RunningHub or any cloud image service. Check the model and checkpoint licenses before commercial use. Without a working local checkpoint, image generation produces a clearly marked branded SVG/illustration placeholder; it is not represented as AI artwork.

## Local speech

Piper is preferred when an operator installs a local voice model. Otherwise the app can use an installed `espeak` executable. Configure as needed:

```dotenv
PIPER_BIN=piper
PIPER_MODEL_PATH=/opt/alo/models/bn_voice.onnx
ESPEAK_BIN=espeak
VIDEO_FONT_PATH=./public/fonts/HindSiliguri-Bold.ttf
```

Piper/eSpeak synthesize spoken narration, not singing. Do not clone or imitate a real person's voice without the required permission. The `bn` voice ID must exist in the selected local speech engine; not every distribution includes a natural Bangla voice. Hind Siliguri UI/video font files are bundled from Google Fonts' source repository under the SIL Open Font License; the full license and attribution are in `public/fonts/OFL-HindSiliguri.txt`, and the app no longer fetches fonts from Google during builds.

## Songs and video

- `POST /api/music/generate` asks the local Ollama model for an original Bengali lyric draft when available and creates a stereo WAV instrumental using the built-in deterministic procedural synthesizer. If Ollama is unavailable, it marks the lyrics as a template fallback. The downloaded track is instrumental only—no vocals are sung.
- `POST /api/video/cinematic` uses a local ComfyUI image for each storyboard group when configured; otherwise it creates local abstract branded placeholders. FFmpeg adds slow Ken Burns movement, Bengali captions/SRT, local synthetic speech, and a procedural music bed. This is a cinematic-style still-image slideshow/motion graphic, not frame-by-frame AI-generated footage.
- `POST /api/video/generate` renders a local text-led social video with synthetic narration and the same procedural music engine.
- Generated audio/video/scene assets are written below `storage/audio`, `storage/videos`, and `storage/scene-assets`; these paths are git-ignored. Audio and video are served through authenticated `/api/media/...` routes, including byte-range playback for MP4.
- Audio upload transcription is not enabled. The cinematic endpoint accepts text, not an arbitrary server file path.

## Operations and limitations

- Local inference still consumes the host's RAM/VRAM, CPU/GPU, disk, power, and operator time. Dashboard cost figures are stored estimates, not verified invoices or provider telemetry; missing/zero values do not prove a service is free.
- Model downloads, model-license compliance, GPU performance, accessibility, output quality, moderation effectiveness, and production concurrency have not been independently verified here.
- Content packages, email drafts, song lyrics, narration scripts, and image prompts can run sequential local writer → critic → finalist passes. Actual pass states are returned/logged; if Ollama is unavailable, downstream passes are marked skipped and the template fallback remains visible. These passes and structural/editorial rubric scores are not factual verification and do not establish a measured “10×” improvement.
- The email endpoint only creates a draft and logs its agent stages. No email sender, consent/suppression system, unsubscribe endpoint, or SMTP/Resend integration is available.
- Production administrator login requires a fixed-phone SMS OTP through an operator-configured HTTPSMS-compatible endpoint. Codes are stored as HMACs and limited, but a gateway's queued response does not prove delivery; SMS charges may apply. This is a non-AI external integration and was not exercised here.
- The application has a single administrator, not multi-user roles or public-user isolation. The OTP route has send/attempt limits, but there is no general IP-based login/API rate limit. Do not advertise it as an open public service until identity/roles, edge rate limits, storage quotas/retention, abuse controls, backups, and live deployment checks are implemented and tested.
- Facebook page access/publication is not automatic. The provided page link is presented for reference only; its content has not been fetched or verified. Marketing kits remain human-reviewed and are not sent/published by this local-generation pipeline.
