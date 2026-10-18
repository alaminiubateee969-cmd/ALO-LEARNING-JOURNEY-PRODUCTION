# ALO Learning Journey — Production System

## Quick Start

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your values (optional — works without external credentials)

# Push database schema
bun run db:push

# Start development server
bun run dev

# Open http://localhost:3000
```

## Verified Real Features

1. Content Opportunity Score (zai-llm, 6-dimension scoring)
2. Hook A/B Testing (zai-llm, 5 variants)
3. Content Package Generation (zai-llm, full Bengali package)
4. Protective Mode (zai-llm, safety review)
5. Comment Classification + Reply (zai-llm)
6. Image Generation (zai image-gen, real PNG files)
7. Video Generation 50s (espeak TTS + FFmpeg, ffprobe verified)
8. Video Generation 5min (espeak TTS + FFmpeg, ffprobe verified)
9. Cinematic Video 50s (subtitles + scene images + storyboard)
10. Bengali TTS (espeak bn voice)
11. Natural Language Command Center (zai-llm, Bengali/English)
12. SEO Content Brief Generator (zai-llm)
13. Telegram Commands (real allow-list, real execution)
14. RAG Search (hybrid keyword + document, 7 citation fields)
15. CSV/JSON Export (all 8 combinations)
16. Backups (XOR + DB copy, real .alo.bak files)
17. Growth Loop Dashboard (real scores, hooks, campaigns)
18. Content Categories (37 categories × 8 age groups)
19. Inkbox Adapter Layer (graceful degradation, internal A2A fallback)
20. Human Approval Architecture

## Blocked External Setup (needs credentials)
- Social publishing (OAuth tokens)
- Social metrics (platform API access)
- AI phone calls (Twilio)
- SMS (Twilio)
- WhatsApp (WhatsApp Business API)
- STT (Vosk/Whisper model)
- Face consistency (ML model)
- Voice cloning (specialized model)
- Email (SMTP credentials)

## Architecture
- ALO Agents = brains 🧠
- ALO Orchestrator = manager ⚙️
- ALO Database = source of truth 🗄️
- Inkbox = optional communication/identity layer 📬
- Human Approval = safety boundary 🛡️

## Tech Stack
- Next.js 16 + TypeScript + Prisma/SQLite + shadcn/ui
- z-ai-web-dev-sdk (LLM + image generation)
- espeak (Bengali TTS)
- FFmpeg/ffprobe (video generation + validation)
