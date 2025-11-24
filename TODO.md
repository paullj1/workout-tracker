# Workout Tracker TODO

- [x] Serve the React SPA from the FastAPI process (dev + packaged) so API + UI share one origin
- [x] Add a single entrypoint that builds the frontend (if needed) and boots the API
- [x] Implement persistent storage for passkey challenge cache (DB TTL cleanup)
- [x] Add integration tests covering encrypted workout CRUD + trend aggregation
- [x] Build Apple Sign-In UI hook + backend token exchange flow
- [x] Wire automated CI pipeline (lint, type-check, backend/frontend tests)
- [x] Add deployment docs for Postgres + containerized runtime
