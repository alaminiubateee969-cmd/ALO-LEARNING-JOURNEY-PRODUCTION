---
Task ID: marketingos-real-1
Agent: Main Orchestrator
Task: Convert MarketingOS from DEMO/MOCK data to real Prisma-backed CRUD across all views

Work Log:
- Extracted uploaded MarketingOS-FULL-PROJECT.zip to /home/z/my-project/marketingos
- Installed deps via `bun install` (803 packages)
- Generated Prisma client + pushed schema to SQLite
- Ran existing seeds: 120 tools, 2000 employees, 54 departments, admin user
- Audited all 15 views for DEMO_/MOCK_/fake_ data — found:
  * crm-view.tsx: DEMO_LEADS, DEMO_DEALS, DEMO_CONTACTS, DEMO_TICKETS
  * team-view.tsx: MOCK_DATA (members/invitations/auditLogs)
  * settings-view.tsx: MOCK_SESSIONS, MOCK_WEBHOOKS, MOCK_API_KEYS
  * ai-agents-view.tsx: MOCK_STATS + AGENT_DEFINITIONS hardcoded
  * analytics-view.tsx: was hitting /api/dashboard (wrong shape)
  * dashboard API had bugs: stage='closed_won' doesn't exist, closedAt doesn't exist
- Added 3 new Prisma models: Webhook, ApiKey, UserSession (with db push)
- Created 14 new API route files for full CRUD:
  * /api/crm/leads/[id] — PATCH, DELETE
  * /api/crm/deals + /api/crm/deals/[id] — GET, POST, PATCH, DELETE (kanban DnD hits PATCH)
  * /api/crm/contacts + /api/crm/contacts/[id] — GET, POST, PATCH, DELETE
  * /api/crm/tickets + /api/crm/tickets/[id] — GET, POST, PATCH, DELETE
  * /api/campaigns/[id] — PATCH, DELETE (also fixed POST to JSON.stringify metrics)
  * /api/content/[id] — PATCH, DELETE (also fixed POST to JSON.stringify engagement)
  * /api/analytics — real aggregations from campaigns/content/deals/leads/contacts
  * /api/settings/company — GET, PUT (real Company table updates)
  * /api/settings/webhooks + [id] — GET, POST, DELETE
  * /api/settings/api-keys + [id] — GET, POST (returns full key once), DELETE
  * /api/settings/sessions + [id] — GET, DELETE
  * /api/settings/security/password — POST (bcrypt verify + rehash)
  * Rewrote /api/team GET to return members/invitations/auditLogs in view's expected shape
  * Rewrote /api/team POST to handle 5 actions: invite, update_role, remove_member, resend_invitation, revoke_invitation
  * Fixed /api/crm/leads GET to return just {leads} (was returning bundle)
  * Fixed /api/dashboard to use stage='won' (not 'closed_won') and closeDate (not closedAt)
  * Reshaped /api/dashboard response to match dashboard-view.tsx's expected field names
    (kpi.* with connectedSocialAccounts, newLeads30d, contentCreated; activeCampaigns with
    platform/reach/engagement; leadFunnel with stage key; dealPipeline with deals+color)
- Rewrote crm-view.tsx from scratch (~1100 lines):
  * Removed all DEMO_* arrays
  * Real fetch with error handling (no silent fallback to mocks)
  * Added Frappe-style drag-and-drop kanban pipeline for deals (@dnd-kit)
  * Inline status changes for leads (OroCRM-style)
  * Create/Edit/Delete dialogs for all 4 entities (leads, deals, contacts, tickets)
  * List view for deals below the kanban with delete buttons
- Updated team-view.tsx:
  * Removed MOCK_DATA constant
  * Wired useApiQuery to /api/team (was disabled)
  * Updated all mutation calls to use action: 'invite' | 'update_role' | 'remove_member' | 'resend_invitation' | 'revoke_invitation'
  * Removed all "Demo mode" toast fallbacks
- Updated settings-view.tsx:
  * Removed MOCK_SESSIONS, MOCK_WEBHOOKS, MOCK_API_KEYS arrays
  * CompanyTab now loads from /api/settings/company and populates form
  * SecurityTab uses /api/settings/sessions with revoke buttons
  * ApiTab uses /api/settings/webhooks and /api/settings/api-keys with create/delete
  * API key creation shows the full key ONCE (with copy/dismiss UX)
  * Removed all "Demo mode" toast fallbacks
- Updated ai-agents-view.tsx:
  * Removed MOCK_STATS constant
  * Wired useApiQuery to /api/ai-agents (was disabled)
  * Maps DB AiAgent records to view's expected shape via JSON.parse(config)
  * Toggle now calls PATCH with { id, isEnabled } (matches API contract)
- Updated analytics-view.tsx:
  * Changed fetch from /api/dashboard (wrong shape) to /api/analytics (correct shape)
- Fixed campaigns-view.tsx:
  * Made formatNumber and formatCurrency defensive against undefined/null values
  * Updated /api/campaigns GET to parse metrics JSON before returning
- Added `allowedDevOrigins: ['127.0.0.1', 'localhost', '21.0.4.113']` to next.config.ts
  to fix HMR connection from agent-browser / preview proxy
- Made prisma/seed.ts idempotent via upsert on company slug + existing-user check
  for team members (so re-running seeds doesn't crash)
- Created 2 new seed files:
  * prisma/seed-crm.ts — 50 leads, 30 contacts, 25 deals, 15 tickets, 10 campaigns, 20 content items, 3 SEO challenges
  * prisma/seed-ai-agents.ts — 9 AI agents across 9 categories
- Copied all MarketingOS files from /home/z/my-project/marketingos/ to /home/z/my-project/
  (system project root where `bun run dev` auto-runs)

Stage Summary:
- All API endpoints verified working with real Prisma/SQLite data:
  * 180 leads, 87 deals, 90 contacts, 15 tickets
  * $1.17M revenue, $4.94M pipeline, 147% ROI
  * 14 campaigns with real metrics (reach, clicks, conversions)
  * 33 content items with engagement data
  * 9 AI agents (5 enabled by default)
  * 120 integration tools across 27 categories
  * 2,000 AI workforce employees across 54 departments
- Browser-verified via Agent Browser:
  * Login flow works (admin@marketingos.com / admin123)
  * CEO Dashboard renders with real KPIs (180 leads, $1.17M revenue, 15 campaigns, 25 AI agents)
  * CRM view renders 180 leads with inline status changes + Add Lead dialog
  * CRM Deals tab shows 6-stage kanban pipeline with drag-and-drop
  * Campaigns view renders 14 real campaigns with metrics (Reach, Clicks, Conversions)
  * Analytics view renders 6 KPIs + 4 real charts (engagement over time, content type,
    platform comparison, campaign ROI, top content)
  * Team view renders 6 real members with role management
  * Settings view shows real Company info (loaded from DB), API keys, webhooks, sessions
- Dev server: Next.js 16.3.5 (Turbopack) running on port 3000
- Preview URL: https://preview-6aac8406.space-z.ai/
- Login: admin@marketingos.com / admin123
