# Data migration report

Source extraction was executed locally against the immutable complete HTML and passed the automated extractor test.

The executable dry-run also passed with source checksum `e4390ea4dd8564b1b1140daf0b5447d2268c040d1b81c57f2d415626f8e0c1c3`.

| Measure | Expected | Extracted |
|---|---:|---:|
| Dataset ID | `sbm-delivery-board-2026-11-21` | matched |
| Deliverables | 622 | 622 |
| Subtasks | 973 | 973 |
| Members | 20 | 20 |
| Towers | 9 | 9 |
| Directory contacts | 20 | 20 |
| Comments | 622 | 622 |
| Dependencies | 10 | 10 |
| Stage histories | 1,882 | 1,882 |
| Top-level activity | 1 | 1 |

Stage extraction: backlog 2, todo 26, doing 28, review 9, done 477, deployed 80.

Database seed/verification was not run because no MongoDB service/connection was provided in this environment. Consequently there is no real ImportBatch ID or database-side actual count to report yet. Run `npm run seed:legacy`, then `npm run verify:legacy`; the command prints the batch ID, checksum, expected/actual counts, stage counts, and unresolved dependency total and fails on any discrepancy.

Known source warnings to expect include 597 missing tickets, 25 missing start dates, 25 missing due dates, 29 missing/zero direct estimates, 2 missing primary owners, 31 multi-assignee tasks with 39 extra references, and 16 deployment-ready tasks without plan dates. These are preserved, not repaired automatically.
