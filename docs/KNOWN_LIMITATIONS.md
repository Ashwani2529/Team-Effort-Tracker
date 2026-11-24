# Known limitations

The repository is a production-oriented foundation with core work management and 12 real views, but the following acceptance items are not yet complete and must not be represented as finished:

- MongoDB was not available during this run, so the actual seed, idempotent rerun and database verification report have not executed. Source extraction/count validation did pass.
- Planner XLSX/CSV preview/commit, directory file import and bulk-paste UI/services still need implementation on top of ImportBatch/ImportRowResult.
- Privileged multi-sheet Excel export, scoped JSON restore validation and import rollback are pending. CSV, ICS and scoped JSON export exist.
- Member creation with required name/email and date-specific roster editing are implemented; member edit/archive plus standalone leave/holiday CRUD remain incomplete.
- Attachment upload/download and email-file ingestion need a configured protected blob provider and malware scanning.
- Full deliverable editing is available to Team and Admin users. Deliverable deletion remains Admin-only; comments and worklogs use owner-or-Admin edit/delete rules. Legacy subtask/dependency source data is retained for migration provenance but is intentionally absent from the active product UI.
- Notification models/read APIs/UI exist, but assignment/mention/due/blocker trigger jobs and user preferences are incomplete.
- Audit writes exist; Activity currently returns preserved legacy activity, not a paginated merged audit stream.
- Advanced legacy metrics (full sprint forecast, CFD, cycle percentiles, flow efficiency, WIP target administration) need dedicated server reporting endpoints. Current Framework/Reports compute a useful subset.
- Portfolio/project archive/edit and broader settings endpoints/UI need completion.
- Socket.IO integration/reconnection tests and a scale-out adapter are pending.
- The frontend main bundle is 1.13 MB minified (339 KB gzip); route/chart lazy loading should be added.
- Full accessibility, cross-browser, tablet/mobile visual QA and database-backed password-flow E2E remain pending.

These limitations are also reflected in `FEATURE_PARITY_MATRIX.md` so unfinished work cannot be mistaken for parity.
