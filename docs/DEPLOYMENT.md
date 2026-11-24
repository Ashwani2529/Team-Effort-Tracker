# Deployment

Build with npm ci followed by npm run build. Deploy frontend/dist and run node backend/dist/server.js.

Required production configuration:

- HTTPS and an exact FRONTEND_ORIGIN allow-list;
- APP_SETUP_PASSWORD, SESSION_SECRET, LEGACY_PROJECT_PASSWORD and LEGACY_ADMIN_PASSWORD from a secret manager;
- a same-origin reverse proxy so strict cookies work reliably;
- MongoDB TLS, least-privilege credentials, backups and tested restores;
- WebSocket support; add a Socket.IO adapter before multiple API instances;
- centralized logs with cookies redacted;
- controlled index creation and a one-time audited migration job.

Production startup rejects the bundled development setup/session values. Run typecheck, lint, tests, build, E2E, migration verification, accessibility and responsive QA before release.
