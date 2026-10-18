# Database architecture — current review

- Current persistence: Prisma/MySQL. See `prisma/schema.prisma` and five migration directories.
- 42 schema models cover company, agent runs, approvals, RAG documents/chunks, audit, CRM, content/media, OTP, voice/avatar and related records.
- Existing AgentOS virtual descriptors are generated in TypeScript and are not persisted as 2,000 DB rows; 20,000 skill descriptors are virtual and not written as operational records.
- No `Task`, `TaskStep`, generic `Workflow`, versioned `Skill`, `CapabilityRequest`, or unified policy decision model was added in the current work.
- Do not use a parallel SQLite file for core identities/tasks. Decide on additive Prisma models and migrations only after exact production DB backup/restore and migration-history review.
- Production schema, row counts, tenant isolation, indexes, migration checksums, and backup restoration remain UNVERIFIED.
