# Data model

Hierarchy: local Organization -> Portfolio -> Project. Project-owned documents carry all three IDs.

| Model | Purpose |
|---|---|
| Organization | Local workspace root with unique slug |
| Portfolio | Project grouping and legacy dataset identity |
| Project | Metadata, salted Team/Admin password hashes and passwordVersion |
| Tower | Project workstream |
| Member | Manually managed schedulable person; name and unique project email required |
| DirectoryContact | Imported address-book profile |
| Deliverable | Six-stage work, separate delivery/deployment dates, effort, one optional subtask parent, dependency links, blockers, comments and status history |
| Worklog | Verified effort entry; reporting attributes hours to the task's primary assignee while preserving the submitting member for audit |
| Attachment | Protected storage metadata |
| AuditEvent | Mode/action/entity/before/after/metadata |
| Notification | Shared project notification state |
| Leave / Holiday / ShiftDefinition / RosterOverride | Availability and roster data |
| ProjectSettings | Project-level values |
| ImportBatch / ImportRowResult | Migration and import provenance |
| LegacyActivity | Preserved source activity |

There are no User or Membership identity models. Team members are project data, not login accounts.

Daily capacity is calculated from the roster and allocation: General/Night contributes 8 hours multiplied by allocation, while Leave/Off contributes zero. Analytics are recalculated from current non-deleted tasks and worklogs.
