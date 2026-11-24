# Project access

Effort Tracker has two access modes. Identity is the project member record matched by email; authentication remains project-password based and does not use an external identity provider.

## Passwords

- APP_SETUP_PASSWORD is an application-level environment secret. It is required only when creating a new project.
- Every project has a shared Team password and a distinct Admin password. Entry also requires an email already present in that project's active member list.
- Team and Admin passwords are salted with a random 16-byte salt and hashed with Node.js scrypt.
- Only password hashes are stored in MongoDB. Passwords are never returned by the API.
- Password endpoints are rate-limited. Production traffic must use HTTPS.

## Sessions

After a registered email and correct Team password, the API issues an HTTP-only, same-site, signed project cookie. It contains the project ID, member ID, mode, remembered Admin grant, password version and expiration. JavaScript cannot read it.

The Admin toggle prompts for the project Admin password once per session. After successful verification, switching between Team and Admin mode does not prompt again. Toggling never extends the original expiry. Locking the project clears the cookie.

Team access and remembered Admin authorization expire after 30 days. The member must enter their email and Team password again; the next Admin switch requires the Admin password again.

Each project has a passwordVersion. Changing either password increments it, invalidating every older browser and Socket.IO session. The Admin performing the change receives a renewed Admin session.

One browser cookie opens one project at a time. Moving to another project prompts for that project's shared password.

## Capabilities

Team mode can use all normal operational views and edit project work. Admin mode adds:

- Reports and every export;
- the Admin view and project settings;
- creating members, including required name and email;
- project password changes;
- deletion and other destructive operations.

Both the React routes and API capabilities enforce premium access. Client-side hiding is not treated as authorization.

## Project creation

POST /api/v1/projects requires the application password, portfolio/project metadata, creator name/email, and both new project passwords. The creator is inserted as the first project member and receives a 30-day Admin session.
