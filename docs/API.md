# API

Base path: /api/v1. Project routes use an HTTP-only signed project-session cookie.

| Method/path | Access | Behavior |
|---|---|---|
| GET /health | public | Process health |
| GET /config | public | Non-secret access configuration |
| GET /projects | public | Project names and portfolio labels |
| POST /projects | application password | Create a project, first member and Team/Admin passwords |
| POST /projects/:projectId/unlock | registered email + Team password | Start 30-day member-bound Team session |
| POST /projects/:projectId/admin-mode | active session + first-use Admin password | Enter Admin mode; reuse remembered grant on later toggles |
| POST /projects/:projectId/team-mode | active session | Downgrade to Team mode |
| POST /projects/:projectId/lock | active session | Clear session |
| PATCH /projects/:projectId/passwords | Admin | Change passwords and invalidate earlier sessions |
| GET /projects/:projectId/snapshot | Team/Admin | Scoped workspace data |
| POST /projects/:projectId/members | Admin | Create member; name and email required |
| PUT /projects/:projectId/roster/:memberId/:date | Self/Admin | Set General, Night, Off or Leave for one IST date; Leave stays synchronized |
| POST/PUT/PATCH deliverable routes | Team/Admin | Create/edit/status workflows |
| DELETE deliverable | Admin | Audited soft delete |
| POST comments/worklogs | Team/Admin | Create member-attributed comments and verified effort notes |
| PATCH/DELETE own comments/worklogs | Team | Correct or remove entries created by the signed-in member |
| PATCH/DELETE any comments/worklogs | Admin | Correct or remove any project entry |

Errors use {error, message?, issues?}. Status 401 means a password/session is missing or invalid; 403 means the email is not an active project member or Admin mode is required; 404 is scoped absence; 409 is a version conflict.

Socket.IO reads the same signed cookie and permits only the cookie project room. Delivery events invalidate the project snapshot.
