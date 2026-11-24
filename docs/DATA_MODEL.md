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
| Deliverable | Six-stage work, dates, effort, blockers, quality, comments and status history |
| Worklog | Member-attributed verified effort and detail notes |
| Attachment | Protected storage metadata |
| AuditEvent | Mode/action/entity/before/after/metadata |
| Notification | Shared project notification state |
| Leave / Holiday / ShiftDefinition / RosterOverride | Availability and roster data |
| ProjectSettings | Project-level values |
| ImportBatch / ImportRowResult | Migration and import provenance |
| LegacyActivity | Preserved source activity |

There are no User or Membership identity models. Team members are project data, not login accounts.
