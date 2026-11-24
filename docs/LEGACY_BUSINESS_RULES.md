# Legacy business rules

## Identity, roles and capability

The legacy source contained five personal roles. The approved rebuild intentionally replaces them with shared Team mode and password-protected Admin mode. Team mode edits normal work; Admin mode adds Reports, exports, settings, member management and destructive actions. Legacy member role values are not used for access.

## Workflow and validation

Stages are `backlog`, `todo`, `doing`, `review`, `done` (Delivered), and `deployed`. Delivered and Deployed are never collapsed or hidden from the default board. New items require title, tower, stage, priority, primary assignee, ticket or `N/A`, start, due, and a positive deliverable estimate. Delivered/Deployed require completion; Deployed also requires deployment. Blocked requires a reason; “To be Deployed” requires a plan date.

Start cannot follow due; completion cannot precede start or be future-dated; deployment cannot precede completion. Subtasks require titles. Legacy records are exempt from required-field fabrication and receive data-quality warnings.

`setStatus` appends history. First entry into Delivered/Deployed sets the IST completion date only if absent. Deployment is separate. Returning to an open stage cleared derived completion/deployment in the old app; the rebuild records the transition and retains audit evidence. Completion corrections require Team Lead or higher. Moving active while dependencies remain unfinished is allowed with a warning. Dependency cycles are rejected.

## Dates and period membership

“Today” is Asia/Kolkata. Day, Monday–Sunday Week, calendar Month and Custom are retained. Open work belongs when its start–due interval overlaps the period. Finished work belongs to the completion date; Deployed work uses deployment date, falling back to completion only for imperfect history. “Include earlier overdue” includes open work due before the period. The old Board forced Deployed to the current IST week. Explicit All Active and All History modes remove ambiguity.

## Effort modernization

Legacy automatic actual effort counted the assignee's working hours from start through today/completion within `istStart`–`istEnd`, skipping leave/holidays/off days. Manual effort was optional. If subtasks carried hours, estimates and actuals rolled up from subtasks instead of the parent.

The rebuild preserves legacy values and provenance but does not call calendar-derived hours verified actuals. Worklog minutes are authoritative. Remaining is `max(0, deliverable estimate - verified actual)`. Each verified worklog is attributed to the signed-in project member and shown as a note in task Details.

## Scheduling and capacity

`dayStatus` precedence is whole-team holiday, member leave, roster override, then base working-day shift. Capacity per working day is `hoursPerDay × allocation% × focusFactor%`. Load is remaining effort on open work due by the horizon. Subtask work uses its assignee or falls back to primary; unassigned load stays explicit. Overnight shifts are represented with end time earlier than start time and must be treated as crossing midnight.

## Metrics

Sprint length is `sprintWeeks × 7`, anchored to `sprintAnchor`. Velocity is estimated hours completed in a sprint. Predictability is committed items completed by sprint end divided by committed items. Cycle starts at first Doing-or-later history and ends at completion; lead starts at creation. Rework counts reverse transitions from Review-or-later to Todo/Doing. On-time compares completion date to due. Deployment lag is deployment minus completion. Test automation is automated/total tests; escape rate is escaped/(defects+escaped). Metrics lacking evidence remain null/“—”.

## Imports and exports

Bulk paste format is `Title | Assignee name | Assignee email | Due date | Tower | Est hours | Ticket # | [Priority]`. Name and normalized email must identify the same member, tower must exist, estimate must be positive, due must be a valid future `YYYY-MM-DD`, and ticket is required (`N/A` accepted).

Planner rows are detected from a header containing Task Name/Name and at least four populated columns. Planner IDs are project/source scoped and deduplicated. Label/bucket mapping determines stage, tower, blocker and deployment readiness. Planner completion/history dates can be approximate and must be labeled. Extra assignees become contributors when resolvable. CSV fields are quoted by doubling quotes; ICS escapes backslash, semicolon, comma and newline and uses exclusive end dates.

## Preservation defects intentionally not normalized

- Missing tickets, dates, owners, direct estimates, and deployment plans stay missing.
- Existing completion/deployment/history values remain source evidence even when approximate.
- Multiple legacy assignees retain one primary plus resolvable contributors.
- Legacy auto hours never become worklogs.
- The source dataset is imported explicitly once, never on server startup.
