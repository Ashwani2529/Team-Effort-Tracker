# Legacy data migration

`backend/src/services/legacy-extractor.ts` reads the complete HTML as text, finds the literal `const STARTER=` and the adjacent `function applyStarter` boundary, parses only the intervening JSON, validates dataset identity and every acceptance count, and hashes the source object with SHA-256. It does not execute the HTML or object as JavaScript.

`npm run seed:legacy -- --dry-run` extracts, validates and prints source metadata without connecting writes. Normal seed creates/identifies the organization, portfolio and project; upserts towers, members, directory and privileged legacy memberships; then insert-only upserts all deliverables and activity.

Deliverable IDs are deterministic SHA-256-derived Mongo ObjectIds based on dataset and legacy ID. Dependency IDs are mapped with the same function before insertion. Extra resolvable `assigneeIds` become contributors. Source nulls remain null. Warnings identify missing ticket/start/due/estimate/owner/deployment plan and multiple legacy assignees. Calendar-derived actuals stay `legacyActualHours`; `worklogMinutes` starts at zero.

Uniqueness is enforced by source dataset/project/legacy ID and source/project/Planner ID. `$setOnInsert` prevents reruns from overwriting edits. A completed ImportBatch causes a rerun to verify only. Partial runs can safely resume because each source record is independently idempotent; the batch is marked complete only after verification.

Verification compares all core counts, per-stage counts, comment/subtask/history/dependency totals, and ensures every dependency target exists. Any mismatch returns a nonzero process exit code.

The imported project receives the Team and Admin passwords configured by LEGACY_PROJECT_PASSWORD and LEGACY_ADMIN_PASSWORD. Member emails remain project data and do not create login accounts.

Rollback is not automatically destructive. Use the recorded ImportBatch/project scope to export/backup and perform an explicitly reviewed scoped deletion. Never run an unscoped clear.
