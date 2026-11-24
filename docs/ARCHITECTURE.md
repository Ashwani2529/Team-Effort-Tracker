# Architecture

The repository is an npm workspace with a shared TypeScript domain package, Express/Mongoose API, and Vite React SPA.

    Project password -> React/TanStack Query
                            | REST + Socket.IO, HTTP-only cookie
                            v
                   Express access middleware
                            |
                 services -> scoped Mongoose models
                            |
                         MongoDB

The public landing page exposes project names but no project data. A registered member email plus the shared Team password creates a signed, member-bound, 30-day project session. The Admin toggle verifies the separate Admin password once and remembers that grant for mode switching until the same session expires. The server derives identity and capabilities from the signed cookie and current project membership.

Passwords use salted scrypt hashes. Session signatures use SESSION_SECRET, expire, and include passwordVersion. Password changes invalidate older REST and real-time sessions. Password endpoints are rate-limited.

TanStack Query owns server state; theme/search/period remain presentation state. Socket events invalidate scoped queries. Deliverables use optimistic concurrency. The immutable HTML is read only by the migration CLI and is never bundled or served.

Production controls include HTTPS, same-origin deployment/proxying, CORS allow-list, Helmet, rate limiting, Zod validation, project-scoped filters, safe errors, cookie redaction, unique indexes and strong environment secrets.
