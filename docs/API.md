# API

Base path: /api/v1. Project routes use an HTTP-only signed project-session cookie.

| Method/path | Access | Behavior |
|---|---|---|
| GET /health | public | Process health |
| GET /config | public | Non-secret access configuration |
| GET /projects | public | Project names and portfolio labels |
| POST /projects | application password | Create a project with Team/Admin passwords |
| POST /projects/:projectId/unlock | Team password | Start Team session |
| POST /projects/:projectId/admin-mode | active session + Admin password | Upgrade to Admin mode |
| POST /projects/:projectId/team-mode | active session | Downgrade to Team mode |
| POST /projects/:projectId/lock | active session | Clear session |
| PATCH /projects/:projectId/passwords | Admin | Change passwords and invalidate earlier sessions |
| GET /projects/:projectId/snapshot | Team/Admin | Scoped workspace data |
| POST /projects/:projectId/members | Admin | Create member; name and email required |
| POST/PUT/PATCH deliverable routes | Team/Admin | Create/edit/status workflows |
| DELETE deliverable | Admin | Audited soft delete |
| POST comments/worklogs | Team/Admin | Member-attributed comments and verified effort notes |

Errors use {error, message?, issues?}. Status 401 means a password/session is missing or invalid; 403 means the email is not an active project member or Admin mode is required; 404 is scoped absence; 409 is a version conflict.

Socket.IO reads the same signed cookie and permits only the cookie project room. Delivery events invalidate the project snapshot.
