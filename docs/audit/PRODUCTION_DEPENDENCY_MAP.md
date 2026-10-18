# Production dependency map — 2026-10-18

This map describes dependencies from checked-in code/configuration, not verified production processes.

```text
Owner browser
  -> Nginx reverse proxy (config checked in; live config UNVERIFIED)
  -> Next.js 16 / Node 22 standalone application
      -> Prisma Client 6 / MySQL database (DATABASE_URL; live connection UNVERIFIED)
      -> local JSON fallback only outside production by policy
      -> local Ollama (private local URL; status not proven)
      -> local ComfyUI + local checkpoint (optional; status not proven)
      -> local FFmpeg/ffprobe and Piper/eSpeak binaries (availability host-dependent)
      -> filesystem volumes: uploads, generated assets, avatars, audio/video, backups
      -> external SMS gateway only for configured admin OTP (live delivery unverified)
      -> GitHub Actions CI/deploy; Tailscale/SSH workflow (latest deploy run failed)
```

## Runtime/service inventory

| Component | Required/configured by code | Production evidence | Status |
|---|---|---|---|
| Next.js app | Next 16, Node >=22 <23, standalone output | Local build passes. | WORKING locally; production UNVERIFIED. |
| MySQL | Prisma schema datasource and `DATABASE_URL` | No live connection/history inspected. | UNVERIFIED. |
| Ollama | `OLLAMA_BASE_URL`, model defaults to Qwen 2.5 7B in code | No server reachable/benchmarked in this sandbox. CPU RAM unknown. | UNVERIFIED. |
| ComfyUI | `COMFYUI_BASE_URL`, optional local checkpoint | No service/checkpoint verified. | UNVERIFIED. |
| FFmpeg/ffprobe | Bundled installer/runtime paths and Docker packages | Build/test available; production binary versions unknown. | PARTIAL. |
| eSpeak/Piper | Local voice runtime helpers | Host binaries/model availability unknown. | UNVERIFIED. |
| Redis | Not found as a required app dependency in inspected architecture. | No service evidence. | MISSING for requested queue architecture. |
| Qdrant | No verified production adapter/config. | No service evidence. | MISSING/UNVERIFIED. |
| n8n | Existing docs/reference integrations only; no running adapter proof. | No service evidence. | MISSING/UNVERIFIED. |
| Docker/Compose | `Dockerfile`, `docker-compose.yml` | Docker daemon/build not available in this audit. | PARTIAL / UNVERIFIED. |
| PM2 | Ecosystem and deploy configuration present. | No live process list. | UNVERIFIED. |
| Nginx | `deploy/nginx/learn-aloeducation.conf` | No live config validation or reload performed. | UNVERIFIED. |
| Tailscale | Deployment workflow/docs reference it. | Latest deployment failed; tunnel state not inspected. | UNVERIFIED. |
| Cloudflare Tunnel | No verified config in the current app map. | No host access. | UNVERIFIED. |
| External AI | Legacy SDK calls gated by two opt-in server env switches; shared text/image uses local adapters/fallbacks. | Local model test/quality and costs unavailable. | PARTIAL; default fail-closed. |
| Provider free-tier APIs | No provider onboarding/router. | Not configured. | MISSING. |
| Domains listed in prompt | `aloeducation.com`, `english.aloeducation.com`, `learn.aloeducation.com`, `alolabs.net`, `panel.alolabs.net` | Network access to these hosts/live DNS is not available in this audit environment. | UNVERIFIED. |

## Highest-risk dependency concerns

1. MySQL and media storage consistency across backup/restore/release switch.
2. CPU-only model capacity and concurrency: no model benchmark or memory headroom is known.
3. Deployment depends on GitHub secrets, Tailscale/SSH and host state; failure logs were unavailable.
4. n8n, Qdrant, Redis and a durable worker are not current verified dependencies; do not claim AgentOS can use them.
5. npm audit currently flags 13 advisories; upgrade plans must be tested against Next 16/Prisma 6 architecture.
