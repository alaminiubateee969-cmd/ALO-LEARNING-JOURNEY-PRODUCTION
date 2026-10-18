# Reference link review — complete evidence pass (2026-10-17)

> **Historical snapshot — not current production evidence.** This document
> refers to an earlier checkout/date and may contain stale paths, counts,
> test results, or infrastructure claims. Use the current repository
> baseline at `../COMPLETE-AUDIT-REPORT.md`, deployment blockers at
> `../DEPLOYMENT.md`, and migration procedure at
> `../MIGRATION-RECOVERY-PLAN.md`. Do not execute commands here against
> production without a new review and explicit authorization.


> This pass covers **every link supplied in the 2026-10-17 message**, one row per unique link. Each row records: how the source was inspected, what implementable elements it contained, and where those elements landed in this repository (or why the source is a documented boundary). Earlier 2026-10-10 evidence (metadata + README sampling) is preserved in the "Prior review" section at the bottom.

## Inspection methods used this pass

- **GitHub API** (`api.github.com`): repository metadata for all 33 unique repos — size, language, licence, description. Live status confirmed (all resolve; 0 404s in this list).
- **Shallow clone + source reads** for the design/content-critical repos: `cathrynlavery/diagram-design` (skill refs, style guide, CHANGELOG, import specs), `coreyhaines31/marketingskills` (50 skill dirs + sequence/cadence references), `blader/humanizer` (SKILL.md §1–§26), `mohamed11sk/Email-markting`, `knsoftic/Email_Markting` (campaign/automation structure).
- **README reads** (via API) for every other repo in the list.
- **Full page fetches for all 9 non-GitHub websites** — these had never been fetched in the prior pass. Evidence below.

No third-party code or assets were copied. Implementations are original TypeScript keyed to the *patterns* each source documents; licences (notably ToolJet AGPL-3.0, OpenViking AGPL-3.0, VoiceStudio AGPL-3.0, RedditVideoMakerBot GPL-3.0, ComfyUI-VideoHelperSuite GPL-3.0) forbid copying code into this MIT project.

---

## 1. Diagram & button design family (explicitly requested)

| Link | Inspection | Implementable elements | Where they landed |
|---|---|---|---|
| [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | **Deep read**: v2.6.110 manifest, CHANGELOG, `style-guide.md`, `primitives-core.md`, `import-drawio.md`, `import-excalidraw.md`, `export-registry.md`, `output-spec.md` size presets | 45-type catalogue, 5-skin token system (accent `#bf4520` 4.71:1 contract), 7 semantic node treatments (focal/backend/store/external/input/optional/security), 6 connector rules, **draw.io redraw importer**, **Excalidraw redraw importer**, **`.registry.json` block-registry exporter**, 10 size presets incl. **print-a3-landscape** (1584×1120), offline system-fonts option, fidelity ledger on every import | `src/lib/diagram-design.ts` (treatments + size presets + offline fonts), **new** `src/lib/diagram-import.ts` (drawio/excalidraw/registry engines + ledger), `src/app/api/diagrams/route.ts` (import/registry actions), `src/components/alo/DiagramStudioView.tsx` (Import & Redraw tab, fidelity ledger panel, size selector, `.registry.json` export) |
| [omacom/omarchy](https://github.com/omacom/omarchy) | README + manual index (MIT; 1.2 GB distro repo — not cloned whole) | Theme system ("making your own theme"), hotkey register, top-bar/notices patterns | Terminal-chrome + ALO Warm Gold diagram skins; Cmd+K CommandPalette, ThemeToggle, NotificationPanel (prior pass); theme-first customisation language carried into Diagram Studio skins |
| [tt-a1i/archify / twentyhq patterns] (prior manifest) | Prior pass | "Evidence Console" dark skin | `archify-console` skin in `diagram-design.ts` |
| [astryx.atmeta.com](https://astryx.atmeta.com) (Meta design system) | **Full fetch 2026-10-17** | React 19/StyleX system: 180+ components, brandable themes, table row-actions (Edit/Duplicate/Move/Delete), Studio-AI sidebar with export-conversation, checkout & inventory templates | Button family already in `src/components/alo/primitives.tsx` (EditorialButton accent/paper/link, ArchifyToolbarButton, SegmentedControl, HotkeyButton); shadcn/ui set in `src/components/ui/`; BrandSettings theming. Row-action + AI-sidebar patterns recorded as design references |

## 2. Marketing kits & copy family (explicitly requested)

| Link | Inspection | Implementable elements | Where they landed |
|---|---|---|---|
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | **Deep read**: v2.11.37, all 50 `skills/*/SKILL.md`, `emails/references/sequence-templates.md`, `cold-email/references/follow-up-sequences.md` | 50-skill catalog; 7-touch Welcome Sequence (day 0→14); 5-touch partner cadence (day 0/3/7/14/21 breakup, Thursday 6.87% peak); re-engagement sequence; angle rotation rule | `MARKETING_SKILLS_CATALOG` (all 50) + 3 new kits with `cadence` metadata: `welcome-nurture-sequence`, `partner-followup-cadence`, `reengagement-recovery` in `src/lib/marketing-kits.ts`; cadence panel in `MarketingKitsView.tsx` |
| [blader/humanizer](https://github.com/blader/humanizer) | **Deep read**: SKILL.md v3.1.0 §1–§26 pattern catalogue | 26 numbered AI-writing tells with strength ranking | `src/lib/humanizer.ts` extended from 7 → **22 automated rules covering §1–§26** (deep sayings, staged run-ups, arguing with no one, repeated openings, stacked qualifiers, inflated significance, sales language, borrowed authority, chatbot residue, knowledge-limit disclaimers, curly quotes, wrong-reader asides…) |
| [mohamed11sk/Email-markting](https://github.com/mohamed11sk/Email-markting) | Clone + file inventory (PHP/PHPMailer campaign tool) | Campaign/template/media-upload workflow; template management | Prior pass: ALO stays draft-only (no SMTP send). Template→campaign workflow informs `MarketingKitsView` asset tabs |
| [knsoftic/Email_Markting](https://github.com/knsoftic/Email_Markting) | Clone + controller/command inventory (Laravel) | **Automation steps** (`RunAutomations`), **scheduled campaigns** (`DispatchScheduledCampaigns`), **A/B subject decisions** (`DecideAbTests`), SMTP routing health checks | Kit schema extended: `MarketingAssetTemplate.abVariants` (A/B subjects), `sequenceDay`, `MarketingKit.trigger`, `sendWindow`, `cadence[]` in `marketing-kits.ts` — planning metadata only; ALO never auto-sends |
| [buffer.com](https://buffer.com) | **Full fetch 2026-10-17** | Publish queue + calendar + best-time scheduling, Create idea board + AI assistant, Community comment triage, Insights reports, team approval workflows | Feature parity map: `PublishingQueueView`, `SocialView`, `ContentStudio`, `CommentsView`, `AnalyticsView`, `ApprovalQueue`. Queue/insights patterns already present |
| [every-app/open-seo](https://github.com/every-app/open-seo) | README (MIT; Semrush/Ahrefs alternative) | SEO audit / keyword / rank tracking tool surface | `SeoView.tsx` (FAQPage JSON-LD generator, 8-point GEO auditor, pSEO matrix) — prior pass, confirmed this pass |

## 3. Video & media family

| Link | Inspection | Implementable elements | Where they landed |
|---|---|---|---|
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | README (MIT) | Topic→short-video automation: script, TTS, subtitles, render | `/api/video/generate`, `/api/voice/generate`, SRT pipeline (prior pass) |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | README (Apache-2.0) | "Write HTML, render video" agent-first rendering | `/api/video/cinematic` HTML→scene rendering (prior pass) |
| [Augani/openreel-video](https://github.com/Augani/openreel-video) | README (MIT) | Browser-based editor surface (timeline, captions) | `VideoPipelineView` storyboard→render flow (prior pass) |
| [debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio) | README (AGPL-3.0) | Local TTS/voice-clone desktop stack | Local eSpeak/Piper voice pipeline; AGPL noted — no code copied (prior pass) |
| [elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) | README (GPL-3.0) | TTS + background media + captions assembly without an NLE | Assembly model already in video pipeline; GPL noted — no code copied |
| [viniciusenari/slideshow-videomaker](https://github.com/viniciusenari/slideshow-videomaker) | README (MIT) | Pictures + audio track → slideshow | Slideshow mode in `/api/video/generate` (prior pass) |
| [shubhamdevhouse/Animated-VideoMaker](https://github.com/shubhamdevhouse/Animated-VideoMaker) | README (MIT) | Animated text videos (ImageMagick + FFmpeg) | Motion-graphics text scenes in cinematic renderer (prior pass) |
| [Bilal-Belli/videoMakerBOT](https://github.com/Bilal-Belli/videoMakerBOT) | README (MIT) | Talk script + slides → narration video | Script→slides narration flow (prior pass) |
| [leandromoreira/digital_video_introduction](https://github.com/leandromoreira/digital_video_introduction) | README + TOC (BSD-3) | Hands-on video-tech curriculum (image→sequence→codec→encoding) | **New** `src/lib/reference-curriculum.ts` → "Digital Video Foundations" workshop unit shown in `LearningView` |
| [0voice/audio_video_streaming](https://github.com/0voice/audio_video_streaming) | README (collection index) | Streaming-protocol learning paths (RTMP/HLS/WebRTC), 500+ resource structure | **New** "Live Streaming & Delivery 101" curriculum unit (`reference-curriculum.ts`) |
| [Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video), [OpenTalker/video-retalking](https://github.com/OpenTalker/video-retalking), [meituan-longcat/LongCat-Video](https://github.com/meituan-longcat/LongCat-Video), [GAIR-NLP/LiveTalk](https://github.com/GAIR-NLP/LiveTalk), [HKUDS/VideoAgent](https://github.com/HKUDS/VideoAgent), [HITsz-TMG/VideoClaw](https://github.com/HITsz-TMG/VideoClaw), [LoSealL/VideoSuperResolution](https://github.com/LoSealL/VideoSuperResolution), [YaoFANGUK/video-subtitle-remover](https://github.com/YaoFANGUK/video-subtitle-remover), [WuTao-CS/VideoMaker](https://github.com/WuTao-CS/VideoMaker) | READMEs (all verified live) | Diffusion/lip-sync/super-resolution research models; GPU checkpoints; subtitle *removal* (opposite of our SRT generation) | **Documented boundary** (`LOCAL_AI.md`): ALO renders with FFmpeg + local TTS + procedural synth; no frame-level diffusion model is claimed or bundled. Research repos are study references, not dependencies |
| [jitsi/jitsi-videobridge](https://github.com/jitsi/jitsi-videobridge), [Kosinkadink/ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite), [wtz2017/VideoMaker](https://github.com/wtz2017/VideoMaker), [Nncstudio/VideoMakerPro](https://github.com/Nncstudio/VideoMakerPro), [dunossauro/videomaker-helper](https://github.com/dunossauro/videomaker-helper), [burhankocabiyik/videomaker](https://github.com/burhankocabiyik/videomaker), [seed0001/videoMaker](https://github.com/seed0001/videoMaker) | READMEs | SFU server (Kotlin), ComfyUI nodes (GPL-3.0), Android OpenGL encoder, Java editor, desktop helpers, fal.ai cloud pipeline | **Documented boundary**: different runtimes (Kotlin/Android/cloud GPU). Fal.ai/paid-API pipelines conflict with ALO's local-only rule |

## 4. AI-agent & model family

| Link | Inspection | Implementable elements | Where they landed |
|---|---|---|---|
| [huggingface/education-toolkit](https://github.com/huggingface/education-toolkit) | README + tutorials index (Apache-2.0) | Self-contained workshop pattern: duration badges, outcomes, tutorial+slides pairs, translations | **New** "AI Model Hub Literacy" workshop unit in `reference-curriculum.ts` (workshop pattern applied to all 4 units) |
| [cursor/plugins](https://github.com/cursor/plugins) | README + `teaching/` plugin inventory | `teaching` plugin: skill mapping, practice plans, learning retrospectives; PR/docs canvas patterns | **New** "Practice Plan & Learning Retrospective" workshop unit; retrospective checkpoints on every curriculum unit |
| [ToolJet/ToolJet](https://github.com/ToolJet/ToolJet) | README (AGPL-3.0) | Internal-tool builder: dashboards, visual builder, component/data contracts, MCP server | Design reference only for CommandCenter/dashboard surfaces. AGPL-3.0 — no code, components, or assets copied |
| [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | README (MIT) | Multi-agent "software company" role orchestration | ALO's Writer→Critic→Finalist + Safety Guardian council (`agent-runtime.ts`, `agents.ts`) follows the multi-role pattern with original implementation |
| [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | README (AGPL-3.0) | Context DB: agent memory + RAG + skills unified | Pattern reference for `rag/ingest`, `rag/search`, `RagView`; AGPL noted |
| [akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory) | README (MIT) | Long-term memory for coding CLIs, agent handoff | Session/memory persistence patterns in agent runtime; handoff records in `ActivityTimeline` |
| [ruvnet/ruflo](https://github.com/ruvnet/ruflo), [affaan-m/ECC](https://github.com/affaan-m/ECC), [mksglu/context-mode](https://github.com/mksglu/context-mode) | READMEs | Agent harnesses, swarm orchestration, context-window tool-output sandboxing | Harness concepts behind `PipelineRunner`, `workforce` API; context compression informs local-context budgets. ELv2 (context-mode) noted — not vendored |
| [AprilNEA/OpenLogi](https://github.com/AprilNEA/OpenLogi) | README (Apache-2.0) | Linux device-button remapping (mice/keyboard firmware) | Out of scope for a web app — hardware/driver level. Documented here |
| [Lakr233/vphone-cli](https://github.com/Lakr233/vphone-cli) | README (MIT) | Virtual iPhone on Apple Silicon | Out of scope (macOS/Apple Silicon CLI) |
| [alsk1992/CloddsBot](https://github.com/alsk1992/CloddsBot) | README (MIT) | Prediction-market trading terminal | Out of scope for an education platform (and financial-risk surface) |
| [fmtlib/fmt](https://github.com/fmtlib/fmt) | README (MIT) | C++ formatting library | No web-app element; acknowledged |
| [public-apis/public-apis](https://github.com/public-apis/public-apis) | README (index) | Curated free-API directory | `ApiReferenceView` + `/api/openapi.json` stand as ALO's API surface; directory pattern informs the "official source" linking habit |
| [ramon-victor/freegpt-webui](https://github.com/ramon-victor/freegpt-webui), [Lin-jun-xiang/docGPT-langchain](https://github.com/Lin-jun-xiang/docGPT-langchain), [teremterem/claude-code-gpt-5-codex](https://github.com/teremterem/claude-code-gpt-5-codex), [GetGoAPI/Free-GPT-Grok-Gemini-Claude-API](https://github.com/GetGoAPI/Free-GPT-Grok-Gemini-Claude-API), [zai-org/GLM-5](https://github.com/zai-org/GLM-5), [songguoxs/gpt4o-image-prompts](https://github.com/songguoxs/gpt4o-image-prompts), [tinystruct/smalltalk](https://github.com/tinystruct/smalltalk) | READMEs | Chat web UIs, doc-chat RAG, LiteLLM proxy routing, free-API aggregators, GLM model cards, image-prompt libraries, IM + ChatGPT module | **Boundary + patterns**: ALO is local-first (Ollama/ComfyUI/eSpeak) and forbids paid/free external AI APIs by policy (`.env.example`, `SECURITY.md`). Doc-chat pattern lives in `rag/*` + `RagView`; prompt-library habit informs the 3-agent image-prompt pipeline; GLM-5/gpt4o prompt cards used as *study* references for `content/generate` prompts only |
| [bun/node tooling repos in prior manifest] | Prior pass | — | unchanged |

## 5. Websites (all fetched this pass — first time)

| Link | What it is (fetched evidence) | Implementable elements | Where they landed |
|---|---|---|---|
| [enerpize.com](https://www.enerpize.com) | Cloud ERP: billing, POS, accounting, inventory, HRM, CRM, industry-customised experience (incl. a **Learning** sector: students & courses) | Module IA (Sales/Accounting/Inventory/HRM/Operations/CRM), industry picker, client follow-up, memberships | AdmissionsCRM + `companies` + `family/*` + `costs` + `calendar` modules follow this IA; "Learning: student & course lists" matches ALO's core |
| [aipraktor.com](https://www.aipraktor.com) | Bengali AI commerce agent: Messenger/Instagram/WhatsApp inbox unification, product carousel buttons, order receipts, courier tracking (Steadfast/Pathao), review requests, voice-note orders | Chat-commerce flow: category buttons → product cards → size picker → receipt → tracking → review; Bengali-first UX; quick-reply button patterns | Maps to `SocialView` + `TelegramView` + `CommunicationsView` Bengali conversation flows; receipt/tracking button patterns inform the CRM quotation document & message templates |
| [supercool.com](https://supercool.com) | "Humanoid" assistant: does work while you talk, remembers context, own phone number, meetings, persona faces | Persistent memory ("picks up where you left off"), open-items tracking, persona/face picker, chatbot-vs-humanoid comparison table, FAQ block | Memory/handoff in agent runtime; open-items in `ApprovalQueue`/`PipelineRunner`; persona choices in voice/agent settings; comparison-table + FAQ patterns used in Marketing Kits layouts |
| [join.supercool.com](https://join.supercool.com) | AI movie studio SaaS: one chat → screenplay, scenes, voices, music, trailer, poster; genre grid; "Can it X? Yes." FAQ; persona testimonial wall | End-to-end pipeline structure (write→shoot→edit→release), genre-picker cards, capability Q&A pattern | Matches `VideoPipelineView` storyboard→voice→music→render ordering; genre-card + Q&A patterns adopted in kit/landing templates |
| [buffer.com](https://buffer.com) | Social workspace: Publish queue/calendar, Create idea board + AI assistant, Community comment triage, Insights, approvals | Queue + best-time scheduling, ideas board, cross-account comment inbox | `PublishingQueueView`, `ContentStudio`, `CommentsView`, `ApprovalQueue` parity (see §2) |
| [coder.qwen.ai](https://coder.qwen.ai) | AI coder: prompt → web app, GitHub export, starter templates (coffee store, snake game, solar system, pomodoro) | Starter-template gallery pattern; "build from one sentence" onboarding | Starter-template pattern adopted in Workshop Curriculum ("from one goal to a practice plan"); GitHub-export habit = our `ExportButton` |
| [stackoverflow.com](https://stackoverflow.com) | Q&A: 24M+ questions, tags, votes, accepted answers, bounties, filterable newest/active/unanswered views | Vote/accepted-answer trust model; tag filters; community moderation tiers | Trust & moderation patterns behind `CommentsView` categories + `protective-review`; tag filtering informs Topic/Knowledge filters |
| [mureka.ai](https://www.mureka.ai) | AI music studio: one-line create, Custom, Soundtrack, Remix; lyrics generator + optimize; style enhance; **inspiration templates**; vocal gender; stems; tempo/key | Template chips, vocal perspective, BPM control, lyrics generate/optimize | **New this pass** in `AudioStudioView`: 5 inspiration templates, vocal perspective (neutral/female/male narrator), tempo (72/88/104/120 BPM) wired to `/api/music/generate` |
| [astryx.atmeta.com](https://astryx.atmeta.com) | Meta's open design system (React 19 + StyleX): 180+ components, themes, templates, agent-ready docs/CLI, Studio-AI sidebar, inventory table + row actions | Theme-first customisation, component breadth, table row-actions, AI assistant sidebar | See §1 button family; themes in `BrandSettings`; row-action + sidebar patterns recorded as design references for `ui/` components |

---

## Implementation summary — what this pass added

1. **`src/lib/diagram-import.ts` (new)** — draw.io redraw importer (raw XML + compressed base64/deflate-raw payloads, arrowhead direction semantics, hidden-cell skipping, 10 000-cell guard), Excalidraw redraw importer (bound labels, frames→zones, dangling-arrow accounting, untrusted link/image discard), block-registry exporter (verbatim `data-block-*` → `.registry.json`, document order, no timestamps), shared type-candidate ranking + treatment inference + **fidelity ledger** on every import. All four engines verified with functional tests (raw + compressed drawio, excalidraw with dropped decorations, registry projection).
2. **`src/lib/diagram-design.ts`** — 7 semantic node treatments (focal/backend/store/external/input/optional/security with dashed variants), 10 output-size presets incl. **print-a3-landscape**, offline system-font option, treatment-aware renderer.
3. **`src/app/api/diagrams/route.ts` + `DiagramStudioView.tsx`** — `import_drawio` / `import_excalidraw` / `export_registry` actions, Import & Redraw tab with source switcher and fidelity-ledger panel, size preset selector, `.registry.json` export button.
4. **`src/lib/humanizer.ts`** — 7 → 22 pattern rules spanning the full §1–§26 skill taxonomy.
5. **`src/lib/marketing-kits.ts` + `MarketingKitsView.tsx`** — kit schema extended (`cadence`, `trigger`, `sendWindow`, `abVariants`, `sequenceDay`) and 3 new timed-drip kits (welcome nurture, partner 5-touch with breakup, stalled-lead recovery) implementing the marketingskills sequence research and the Email_Markting automation model; cadence UI panel.
6. **`src/lib/reference-curriculum.ts` (new) + `LearningView.tsx`** — 4 workshop curriculum units adapted from huggingface/education-toolkit (workshop pattern), leandromoreira/digital_video_introduction, 0voice/audio_video_streaming, and cursor/plugins `teaching` (practice plan + retrospective).
7. **`AudioStudioView.tsx`** — Mureka-pattern inspiration templates, vocal perspective, tempo control.

## Boundaries reaffirmed (unchanged policy)

- Local-only generation (Ollama/ComfyUI/eSpeak/FFmpeg/procedural synth). No paid AI APIs; no external model calls. AGPL/GPL sources (ToolJet, OpenViking, VoiceStudio, MoneyPrinterTurbo is MIT but its cloud providers are not used, RedditVideoMakerBot, ComfyUI-VideoHelperSuite) contributed **no code**.
- Email/SMS remain draft/OTP-only. Kits plan sends; they never send.
- Diffusion video/lip-sync/super-resolution research repos remain study references; no such model is bundled or claimed.
- Hardware/CLI-only projects (OpenLogi, vphone-cli, fmt, CloddsBot) are out of scope for this web app and recorded as such.

## Prior review (2026-10-10) — preserved

The earlier manifest pass (138 GitHub slugs; 40 README/deeper document reads across 26 repos) established the first implementation wave: the Diagram & Button Design Studio (`src/lib/diagram-design.ts`, `src/app/api/diagrams/route.ts`, `DiagramStudioView.tsx`, `primitives.tsx`), the 16 original Marketing Kits + 50-Skill Catalog + Humanizer v3.1 (`marketing-kits.ts`, `humanizer.ts`, `MarketingKitsView.tsx`), the Admissions CRM/quotations/planner/enrichment waterfall (`AdmissionsCRMView.tsx`, `crm/*`), OpenSEO/GEO/pSEO (`SeoView.tsx`), and the local video/voice/music pipeline (`VideoPipelineView.tsx`, `AudioStudioView.tsx`, `/api/video/*`, `/api/voice/*`, `/api/music/*`) with `LOCAL_AI.md` boundaries. That pass explicitly did not fetch non-GitHub websites; this pass closes that gap (all 9 fetched above).
