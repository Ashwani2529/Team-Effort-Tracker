# Effort Tracker

Effort Tracker is a multi-project MERN delivery workspace rebuilt from the immutable portfolio-delivery-hub-COMPLETE.html application. Access uses a project member's registered email plus the shared Team password, with a separate Admin password for premium capabilities. There is no external identity provider.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- MongoDB 8, or Docker Desktop

## Windows setup

    cd C:\Users\2400602\Downloads\Projects\Effort_Tracker
    npm install
    Copy-Item backend\.env.example backend\.env
    Copy-Item frontend\.env.example frontend\.env

Set strong unique values in backend/.env:

    APP_SETUP_PASSWORD=<protects creation of new projects>
    SESSION_SECRET=<at least 32 random characters>
    LEGACY_PROJECT_PASSWORD=<shared password assigned during the legacy seed>
    LEGACY_ADMIN_PASSWORD=<admin password assigned during the legacy seed>

Start MongoDB and the application:

    docker compose up -d mongodb
    npm run dev

Open http://localhost:5173. Creating a project requires APP_SETUP_PASSWORD, creator name/email, and new Team/Admin passwords; the creator becomes the first member and Admin. Opening a project requires a registered member email and Team password. The small Admin toggle asks for the Admin password once per 30-day session, then switches modes without repeated prompts.

Passwords must be at least eight characters and are stored as salted scrypt hashes. Project access is held in an HTTP-only, same-site signed cookie. Changing either project password invalidates every earlier project session.

## Legacy import

The seed uses LEGACY_PROJECT_PASSWORD and LEGACY_ADMIN_PASSWORD for the imported project:

    npm run seed:legacy -- --dry-run
    npm run seed:legacy
    npm run verify:legacy

The importer remains insert-only and idempotent. It never executes JavaScript from the source HTML.

## Verification

    npm run typecheck
    npm run lint
    npm test
    npm run build
    npm run test:e2e
    npm audit --omit=dev --audit-level=high

## Structure

- frontend/src/app: project landing, member/project-password gate, remembered Admin toggle, responsive shell.
- frontend/src/routes/Page.tsx: the twelve project views, admin-only Reports/Admin, member creation and password settings.
- backend/src/middleware: signed project sessions, password hashing and capability enforcement.
- backend/src/modules/routes.ts: public project creation/unlock routes and project-scoped APIs.
- backend/src/models: MongoDB domain models and password hashes.
- packages/shared: statuses, Team/Admin capabilities, validation, period and effort rules.
- docs/PROJECT_ACCESS.md: password and mode behavior.
- docs/FEATURE_PARITY_MATRIX.md: honest implementation status.
- docs/KNOWN_LIMITATIONS.md: unfinished scope.

Production deployments must use HTTPS, a same-origin API proxy, strong secrets, restricted database access, backups, and secret-manager supplied environment variables.
