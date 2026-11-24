# Feature parity matrix

Status is based on the implemented repository and local automated verification. “Implemented” means code exists; “tested” is used only where an automated test ran successfully.

| Original view/workflow | Source functions/data | Rules and inputs | New owner | React location | Coverage | Status |
|---|---|---|---|---|---|---|
| Overview | `vOverview`, `attention`, `computeMetrics` | Period-filtered activity, risk queue, stage and effort summaries | snapshot/query services | `Page.tsx/Overview` | frontend smoke; shared filters | implemented |
| Delivery Framework | `vFramework`, `framework`, `computeMetrics` | Demand, capacity, flow, delivery, quality/automation with explainable nulls | shared metrics + reporting API | `Page.tsx/Framework` | shared effort tests | implemented |
| Board | `vBoard`, `filtered(true)`, `setStatus` | Six distinct stages; Deployed remains distinct; accessible drag target; concurrency version | deliverable routes/service | `Page.tsx/Board` | backend status code; compiler | implemented |
| List | `vList`, `deliverableRows` | Searchable dense table; owner/tower/dates/verified effort | snapshot API | TanStack Table in `Page.tsx` | compiler | implemented |
| Assignees | `vAssignees`, `loadByMember` | Primary owner aggregation, remaining load and overdue visibility | reporting query | `Page.tsx/Assignees` | shared remaining-effort test | implemented |
| Timeline | `vTimeline` | Dated non-backlog work in a bounded planning window; missing dates remain visible elsewhere | snapshot API | `Page.tsx/Timeline` | compiler | implemented |
| Calendar | `vCalendar`, `buildIcs` | Due work and planned deployment events; valid exclusive ICS end dates | export service/client | `Page.tsx/Calendar`, Reports | build | implemented |
| Shift Roster | `vRoster`, `dayStatus`, roster actions | Monday-first schedule, working days, shifts, leave/holiday precedence | leave/roster models | `Page.tsx/Roster` | legacy rules documented | implemented |
| Team | `vTeam`, member dialog | Portfolio/project members, role, allocation and shift | membership/member models | `Page.tsx/Team` | auth matrix tests | implemented |
| Reports | `vReports`, `exportExcel`, `csvDeliverables`, `buildIcs` | Access-controlled reporting; CSV quoting; ICS; scoped JSON backup | reporting/export routes (privileged server enforcement remains required for Excel) | `Page.tsx/Reports` | build | implemented; Excel workbook pending |
| Admin | `vAdmin`, settings/member/tower/address-book dialogs | Role matrix, data quality, source provenance, directory | admin/membership/import services | `Page.tsx/Admin` | auth matrix tests | implemented; editing/import UI pending |
| Activity | `vActivity`, `log` | Append-only legacy activity plus new audit events | `AuditEvent`, `LegacyActivity` | `Page.tsx/ActivityView` | model/index checks | implemented |
| Deliverable dialog | `validateItem`, `normItem`, `setStatus` | Strict new-record requirements; incomplete legacy records preserved; date lock for lead+ | Zod + deliverable service | `TaskDrawer.tsx` | shared validation tests | implemented |
| Primary/contributors | `ownerId`, legacy `assigneeIds` migration | Exactly one primary for new work; zero+ contributors; legacy unassigned stays null | migration + deliverable model | create/detail UI | extractor test | implemented |
| Subtasks | `renderSubs`, `rollup`, `SUBST` | Subtask estimate rollup prevents parent double counting | embedded subdocuments + effort rules | task detail | shared effort tests | implemented read/rollup; editing pending |
| Dependencies | `dependsOn`, `unfinishedDeps` | Unfinished dependency warning; cycle prevention | deliverable service | task detail | backend compile | implemented API; picker pending |
| Comments | latest-five dialog behavior | Authenticated author and timestamp; historical comments retained | comments subdocuments/audit | task Activity tab | migration extraction test | implemented |
| Worklogs/timer | legacy `actualHrs` modernized | Verified worklogs authoritative; legacy auto hours reference-only; timer optional | Worklog/TimerSession | Effort tab | shared effort tests | worklogs implemented; timer persistence pending |
| Period filtering | `periodRange`, `inPeriod`, `filtered` | Day/week/month/custom; finished by completion/deployment; overdue option; All Active/History | shared rules | page filter | shared period tests | implemented; custom picker pending |
| Deployed current-week board | `inCurrentWeek`, `filtered(true)` | Legacy board special rule remains available by week; modern All History is explicit | filtering service | Board | documented | implemented via period views; dedicated invariant test pending |
| Capacity | `dayStatus`, `memberCap`, `loadByMember` | holiday > leave > override > base shift; allocation × focus × hours | scheduling/report service | Framework/Roster | documented | partial; persistence models exist |
| Metrics/charts | `sprintStats`, `computeMetrics`, `framework`, charts | Null when insufficient evidence; no fabricated historical worklogs | reporting service | Overview/Framework/Reports | shared unit tests | partial; advanced sprint/forecast metrics pending |
| Bulk paste | `bulkParse` | Seven required pipe columns; name/email same member; future due; valid tower/effort/ticket | ImportBatch/row architecture | Admin | legacy rules documented | not started |
| Directory import | `parseDirectory` | Normalize email; update/skip accounting; no identity trust from file | DirectoryContact/import models | Admin | schema present | backend model only |
| Planner import | `parsePlanRows`, `planBuild` | CSV/XLSX mapping, labels/stages, dedupe Planner IDs, preview before commit | ImportBatch/row + unique indexes | Admin | migration test only | backend foundation only |
| Exports/backup | `exportExcel`, `buildIcs`, JSON restore | Protected exports, correct CSV quotes/ICS escaping, scoped restore validation | export/restore service | Reports | build | CSV/ICS/JSON export implemented; Excel/restore pending |
| Project access | old `ME` replaced | Shared Team password, separate Admin password, signed HTTP-only cookie, password-version invalidation | auth/access middleware | project gate and small Admin toggle | backend password/session tests | implemented |
| Authorization | `ROLES`, `CAPS`, `myRole` simplified | Team edits normal work; Admin adds premium tabs, exports, settings and destructive actions | access middleware | permission-aware nav/routes | shared/backend tests | implemented for current routes |
| Multi-portfolio/project | legacy single project modernized | Every project record scoped; signed project session prevents cross-project access | organization/portfolio/project models and middleware | project chooser/switcher | compiler | implemented core create/scope |
| Real-time | storage polling modernized | Authenticated sockets; verified membership before project room join | Socket.IO | shell query invalidation | compile | implemented; integration test pending |
| Notifications | new requirement | unread list, scoped user ownership, mark read/all | Notification model/routes | bell popover | compile | implemented API/read UI; trigger breadth pending |
| Attachments/email | `mails[]` | Protected metadata/storage; limits/types; legacy metadata retained | Attachment model | task footer | model present | storage provider/upload UI pending |
| Audit | legacy `activity[]` | Append-only mutation audit, actor, before/after, scoped query | AuditEvent | Activity | compile | implemented writes; combined query pending |
| Migration | `STARTER`, `applyStarter` | exact preservation, checksum, idempotency, no invented values | extractor/seed/verify scripts | Admin provenance | passing extractor test | implemented; DB verification requires MongoDB |

The remaining items above are explicitly tracked rather than represented as complete. See `KNOWN_LIMITATIONS.md`.
