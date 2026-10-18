# OmniRoute — Check Report (2026-10-18)

> **Requested:** Check https://github.com/diegosouzapw/OmniRoute
> **Checked at:** commit `778791bb` on branch `release/v3.8.52` (cloned & inspected locally, source-level only — **not installed, not run, no API keys connected**)
> **Verdict in one line:** Legitimate, very active MIT open-source AI gateway — but **DO NOT integrate into ALO production as-is**. It conflicts with ALO's local-only / no-paid-external-AI policy, and many of its "free" routes carry provider-ToS and child-data privacy risk. Sandbox-only trial (no student/family data) is the safe path if the owner wants to evaluate it.

---

## 1. What OmniRoute is

| Item | Value (verified 2026-10-18) |
|---|---|
| Repo | `diegosouzapw/OmniRoute` |
| Version | `3.8.52` (package.json), default branch `release/v3.8.52` |
| License | **MIT** |
| Language / stack | TypeScript, Next.js (same family as ALO), Node `>=22.22.2 <23 \|\| >=24 <27` |
| GitHub | ~78k stars, ~11.3k forks, 260 open issues, created 2026-02-13, pushed 2026-10-18 (today — very active) |
| Size | ~26,894 files, ~800 MB working tree, ~1.9 GB repo — **very large** |
| What it does | One OpenAI-compatible endpoint (`http://localhost:20128/v1`) routing to 359–375 providers / 1200+ models, quota-aware auto-fallback, RTK+Caveman token compression (claims 15–95% savings), MCP/A2A servers, dashboard/PWA/Desktop |
| Install | `npm install -g omniroute`, Docker `diegosouzapw/omniroute`, or from source |
| Data store | Own SQLite DB + optional Redis — separate from ALO's MySQL/Prisma |

It is a **gateway/router**, not a model. You bring your own provider accounts/API keys/OAuth subscriptions; it unifies them behind `/v1/chat/completions`, `/v1/models`, Anthropic/Gemini/Responses-compatible surfaces, and even an Ollama-compatible emulation (`/api/chat`, `/api/tags` under its vscode path).

## 2. How "free" works — the important caveat

OmniRoute does **not** grant free tokens. Its own README states:

> "Bring your own provider accounts… each provider controls its limits, availability, and terms."

The ~1.62B free tokens/month headline is an aggregate of third-party free tiers you must sign up for yourself. Mechanisms in the catalog include:

1. **Legitimate free tiers / API keys** (e.g. Groq, Mistral free tier) — lowest risk.
2. **Subscription/OAuth reuse** — routing your Claude Code / Codex / Antigravity subscription through the gateway.
3. **Web-cookie / session-credential providers** (`docs/getting-started/WEB-COOKIE-GUIDE.md`) and **TLS-fingerprint stealth** — designed to make automated traffic look like a real browser session.

OmniRoute's own docs flag **13 providers as "avoid" in a terms-risk catalog**. Categories 2–3 can violate provider Terms of Service and risk account bans. For a production education product this is not an acceptable supply chain for core features.

## 3. Fit against ALO Learning Journey (current codebase)

### 3.1 Direct conflict with ALO's current AI policy

ALO today is deliberately **local-only**:

- `src/lib/ai.ts` header: *"This shared service never calls paid/external model APIs."*
- `src/lib/local-models.ts` → `getPrivateLocalBaseUrl()` **rejects any public host** for `OLLAMA_BASE_URL` / ComfyUI (only loopback, private IPs, `.local/.internal`, single-label Docker names pass).
- `.env.example`: `ALO_PAID_AI_API_ALLOWED=false` + `ALO_OWNER_APPROVED_PAID_AI_API=false` (double owner-approval switch for any external AI).
- `LOCAL_AI.md`: template fallbacks are explicitly marked; *"Missing local models use fallbacks rather than silently switching to a cloud provider."*

Pointing ALO at OmniRoute **with any cloud/free-tier provider connected** silently breaks all four guarantees: student/family prompts would leave the VPS to third parties, with data-processing, consent, and child-privacy implications that ALO's current docs do not cover. This must not happen without an explicit owner decision + privacy review.

### 3.2 Technical compatibility (if it were approved)

| Aspect | Assessment |
|---|---|
| Runtime | ⚠️ Partial. ALO pins Node `>=22 <23`; OmniRoute needs `>=22.22.2` in that range — OK only on a recent 22.x patch. Runs as a **separate process** (port 20128), never merge it into the ALO Next.js app (26k files / 800 MB). |
| API shape | ✅ Feasible. ALO's `generateLocalChatJson()` posts Ollama-style `POST /api/chat` (`model, messages, format:"json", stream:false`) and parses `payload.message.content`. OmniRoute exposes OpenAI `/v1/chat/completions` (different response shape) and an Ollama-compatible surface — integration needs a small adapter in `local-models.ts` (new provider branch), **not** a drop-in `OLLAMA_BASE_URL` swap without verifying the exact Ollama-emulation path & `format:"json"` support. |
| Private-host guard | ✅ OmniRoute on `http://127.0.0.1:20128` passes ALO's private-host check by design (it *is* loopback) — which is exactly why policy, not just code, must gate what OmniRoute itself routes to upstream. |
| Providers already in ALO | Ollama (`qwen2.5:7b`) + ComfyUI already work directly. OmniRoute adds value only for multi-provider fallback/compression — **zero benefit if upstream stays Ollama-only**. |
| Ops cost | ❌ New dashboard, SQLite DB, optional Redis, postinstall native warm-up (`better-sqlite3`, Rust `wreq-js`), 39k+ test files upstream. Real maintenance/security-update burden next to ALO's PM2/MySQL production (port 3017). |

### 3.3 Security notes (source-level, not a full audit)

- **Positive:** MIT, public `SECURITY.md` with advisory process, loopback-only self-host compose by default, warns `REQUIRE_API_KEY=false` is unsafe on `0.0.0.0`, Redis not published in self-host compose, `STORAGE_ENCRYPTION_KEY` for credential storage.
- **Risks:** it is a **credential concentrator** (dozens of provider keys/OAuth tokens/cookies in one DB — high-value target); `npm -g` install runs **postinstall scripts + native binaries** (supply-chain trust in one maintainer account, 5,554 of the commits are the owner's); Docker examples use `:latest` (unpinned); `.env.example` is 221 KB of provider knobs (large misconfiguration surface); star/commit velocity (78k stars + 10,909 commits in ~8 months, 66 KB `AGENTS.md`) suggests heavy AI-generated code — treat quality/test claims (39k tests, 95% compression) as **unverified marketing until benchmarked yourself**.
- No telemetry exfiltration was found in this quick pass, but this was **not** an exhaustive audit of 26k files.

## 4. Recommendation

**For ALO production (learn.aloeducation.com): ❌ Do not integrate now.**
Blocking reasons: (1) breaks local-only/no-external-AI invariant in `LOCAL_AI.md` + `.env.example`; (2) free-tier/cookie/subscription routing = ToS + child-data risk; (3) unpinned, single-maintainer, credential-concentrating new attack surface; (4) production is already *not approved* per `README.md` (migration rehearsal outstanding) — do not add a gateway on top of an unapproved base.

**Safe evaluation path (owner-approved, optional):**
1. Run OmniRoute **only in an isolated sandbox/VM** (Docker self-host compose, loopback-only, `REQUIRE_API_KEY=true`, pinned image digest — not `:latest`, `OMNIROUTE_SKIP_POSTINSTALL` review first).
2. Connect **one legitimate free-tier API key only** (e.g. Groq/Mistral) — no web-cookie providers, no subscription OAuth reuse.
3. Use it only for **non-personal content-studio drafts** (topics/SEO/marketing — already human-reviewed per `LOCAL_AI.md`), never student/family/OTP/admissions data.
4. Benchmark Bengali quality + latency vs current Ollama `qwen2.5:7b`, and verify `format:"json"` behaviour before writing the `local-models.ts` adapter behind the existing `ALO_PAID_AI_API_ALLOWED` + `ALO_OWNER_APPROVED_PAID_AI_API` switches (default **off**).
5. Only after (1)–(4): owner sign-off, privacy note in `LOCAL_AI.md`, and a kill-switch test (OmniRoute down → marked template fallback, as today).

**Simpler alternative for most of the benefit:** keep direct Ollama, and if a stronger model is needed, call **one** provider directly (e.g. Groq/OpenRouter free tier) through a small guarded adapter — same fallback logic, a fraction of the 800 MB / 375-provider attack surface.

---

*Method: cloned repo to `/tmp/OmniRoute` (outside the ALO repo), inspected `package.json`, `LICENSE`, `SECURITY.md`, `README.md`, `docs/`, `open-sse/config`, self-host compose, and GitHub API metadata; cross-checked ALO's `src/lib/ai.ts`, `src/lib/local-models.ts`, `.env.example`, `LOCAL_AI.md`. No code was installed or executed, no keys used, nothing in ALO was changed except this report.*
