# Integration status — 2026-10-18

| Integration | Source evidence | Current result |
|---|---|---|
| Ollama | `src/lib/local-models.ts`, `.env.example` | Adapter exists; no live local endpoint/model verified. |
| ComfyUI | local image adapter | Adapter/fallback exists; no checkpoint/runtime verified. |
| MySQL/Prisma | schema/migrations | Source configured; no production DB inspection. |
| WhatsApp Business API | no complete client/webhook verified | Not integrated; no message sent. |
| CRM business repositories | 135-source catalog includes several CRM examples | No external CRM repo merged; ALO CRM APIs/models exist partially. |
| n8n | references/department labels | No verified running adapter. |
| Qdrant | no verified runtime adapter | Not integrated/verified; current RAG uses app database code. |
| Free external LLM providers | user-supplied list from previous turn | No onboarding, encrypted secrets, free-model verification or router built. Never paste API keys in chat. |
| Social OAuth/publishing | UI/API records and reserved setup statuses | No verified social OAuth or delivery client. |
| Deployment domains | listed by user | No DNS/host/network checks performed; external domain access unavailable in this audit. |
| Related ALO GitHub repositories | catalog has 404 for three and metadata for `tech360-bd/ALO_WEB_CRM_TECH` | No code pulled or integrations attempted. Request access/correct URLs for 404 repositories. |
