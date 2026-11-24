# Testing

Run from the repository root:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The root test lifecycle builds `@effort-tracker/shared` before backend/frontend tests so runtime package exports resolve consistently. Vite/Vitest scripts use `--configLoader native` for Windows restricted-workspace compatibility.

Current deterministic automated coverage includes:

- Team/Admin capability matrix, including normal Team editing and Admin-only exports/destructive actions;
- project password hashing and signed-session tamper rejection;
- strict new deliverable validation;
- finished/open period membership semantics;
- direct deliverable estimate and verified-worklog accounting;
- default all-status visibility so Delivered/Deployed work remains in its board category;
- verified worklog notes in task Details with removed subtask/dependency/timer sections;
- extraction of the real embedded dataset with all nine acceptance counts and SHA-256 shape validation;
- password-based frontend project landing.

The member-bound project API flow has an isolated MongoDB integration suite covering creation, admission, remembered Admin switching, identity-aware comments/worklogs and a Delivered transition. It is skipped by default because `mongodb-memory-server` may need a first-run binary download; run it with `RUN_MONGO_INTEGRATION=1`. Live Socket.IO, import fixtures, and broader browser flows remain to be added. Never place real employee/task data in fixtures or snapshots.

E2E uses Playwright and starts a production preview. The smoke test verifies the password-based project landing. Full database-backed Team/Admin flows require an isolated MongoDB test database.

For migration verification, `npm run verify:legacy` is a distinct non-mutating database check and is required after the one-time seed.
