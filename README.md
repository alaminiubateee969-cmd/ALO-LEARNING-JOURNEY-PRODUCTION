# Kexsio MarketingOS

Enterprise AI Workforce Platform with 2,000 specialized AI employees, 120+ integrations, autonomous CRM, SEO, content, and campaign automation.

## Quick Start

```bash
# Install dependencies
bun install

# Set up database
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, ADMIN_SEED_PASSWORD
bunx prisma generate
bunx prisma db push
bunx tsx prisma/seed.ts

# Run development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start
```

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma 6 (SQLite dev, MySQL/PostgreSQL prod)
- JWT (jose) + bcryptjs authentication
- z-ai-web-dev-sdk for AI agent execution

## Deployment

Run `bash deploy.sh` for one-click deployment to GitHub + VPS.

See `docs/DEPLOYMENT-RUNBOOK.md` for detailed instructions.
