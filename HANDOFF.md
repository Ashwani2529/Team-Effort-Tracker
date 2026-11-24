# Portfolio Delivery Hub: hand-off brief

Paste this file, plus `portfolio-delivery-hub-LITE.html`, into the new assistant and ask for ONE small change at a time.

## What it is
A single-file HTML app (no build step, no server) that tracks SBM Delivery Board deliverables: Kanban board, list, timeline, calendar, shift roster, team, delivery-framework metrics, reports with Excel export, role-based access, Microsoft 365 address-book import, Planner import.
Runs in the browser. Data is saved with `window.storage` (shared) when opened as a Claude artifact, otherwise `localStorage`. Keys are prefixed `rt3:`.

## How the file is laid out (search for these banners)
`/* helpers */` -> `/* roles */` -> `/* state */` (S, ui, normItem, defaultSettings) -> `/* storage */` -> `/* permissions */` -> `/* domain helpers */` (dayStatus, eff, actualHrs, setStatus, inPeriod, filtered) -> `/* capacity */` -> `/* metrics */` (computeMetrics, framework) -> `/* charts */` -> `/* renderers */` (vOverview, vBoard, vList, vTimeline, vCalendar, vRoster, vTeam, vFramework, vReports, vAdmin, vAssignees) -> dialogs (deliverable, member, leave, day, bulk paste, settings, address book, Planner import) -> exports -> events -> `start`.
The real Planner data is a `const STARTER=...` line (about 750 KB). The LITE file has it emptied. Do not edit that line.

## Data model (state `S`)
`project{name,ref,start,end}`, `settings{maxMembers,minCoverage,hoursPerDay,istStart,istEnd,focusFactor,sprintWeeks,sprintAnchor,wip,targets,shifts}`, `towers[]`, `members[]`, `leaves[]`, `roster{}`, `activity[]`, `dir[]` (address book).
Deliverable: `id,title,ticket,towerId,ownerId (this is the ASSIGNEE; there is one),status,priority,start,due,completedOn,deployedOn,est,act,actMode('auto'|'manual'),blocked,reason,tbd,deployPlan,subs[],deps[],mails[],comments[],hist[],defects,escaped,testsTotal,testsAuto,deployAuto,savedHrs,plannerId`.
Stages: backlog, todo, doing, review, done (Delivered), deployed.
Member: `id,name,email,title,dept,access,days[],shift,alloc,rotate`. Access: owner, delegate (shown as "Tech Lead", owner-level), lead, developer, viewer.

## Rules already implemented (keep them)
- Roles are in-app only, not a security boundary. Only the Owner appoints Tech Leads. Excel/CSV/backup: Owner and Tech Leads. Reports tab: Owner, Tech Lead, Team Lead.
- Every field except Sub-tasks, Depends on, Quality and automation, Comments is mandatory (red `*`). Ticket # accepts "N/A". Completed date required once Delivered/Deployed.
- Assignee is a single mandatory person from the portfolio group. Everything is keyed by email.
- "Today" is IST everywhere. Actual hours are automatic: working hours from start date to today (or completed date) inside the IST window (default 09:00-17:00), Mon-Fri or the assignee's working days, minus leave. A checkbox allows manual entry.
- Completed date defaults to today (IST), is saved as the actual completion date, never changes later, and is locked for roles below Team Lead.
- Period bar (Day/Week/Month/Custom) on Overview, Delivery framework, Board, List, Assignees, Timeline, Reports. Tasks shown must fall in the period: open work by start-to-due overlap, finished work by completed/deployed date. Optional checkbox adds earlier overdue work.
- Board "Deployed" column always shows only the current week (Mon-Sun IST) regardless of period.
- Depends on dropdown excludes Delivered and Deployed work.
- Paste deliverables: `Title | Assignee name | Assignee email | Due date | Tower | Est hours | Ticket # | [Priority]`; name and email must match the same member; due date after today.
- Cards: chips must wrap inside the tile.
- Latest 5 comments and latest 5 updates shown per deliverable.

## Known limits
Last-write-wins storage per collection; no real authentication; Excel export needs internet (SheetJS from cdnjs); Planner export has no real completed dates so imported cycle time and on-time are approximate.

## How to test a change
1. `node --check` on the extracted `<script>` content (syntax).
2. Open the HTML in a browser; use Settings > Clear all data, then add a few items.
3. Check each role via the "Viewing as" selector.
When done, run `python merge_starter.py <original-full.html> <edited-lite.html> <out.html>` to put the real data back.
