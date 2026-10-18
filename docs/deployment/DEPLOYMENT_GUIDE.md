# Deployment guide — repository evidence, not a live deployment

## Current constraints

- Existing project uses Next.js 16 standalone, Node 22, Prisma/MySQL, GitHub Actions, and a checked-in Nginx/PM2/Tailscale deployment design.
- Latest observed Deploy to VPS run `39129438031` failed for base SHA `482fb9b`; logs were unavailable. Do not treat production as updated.
- This audit has no current server access; domain/DNS/proxy/database/CPU/model status is unverified.

## Safe procedure

1. Resolve the latest workflow failure with owner/operator and inspect full logs.
2. Verify exact intended host, release path, service name, ports, auth, and release SHA; do not infer from historical deployment notes.
3. Verify recent backup and an isolated successful restore.
4. Run static checks and CI on the exact source SHA.
5. Review migration checksum/history and change plan; no schema changes in this work.
6. Require owner approval and readiness switch through existing deployment controls.
7. Deploy using the existing audited workflow only; do not run from this document or automate DNS/Nginx/production changes here.
8. Check health endpoint, exact release SHA, logs, auth, MySQL, backups and rollback readiness.

No live deploy was performed as part of this audit.
