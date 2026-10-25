# mongodb-fde-learning

**Movie Store Management**: a small app for learning MongoDB by watching it work. It covers the
anti-corruption layer for external data, what happens as data grows, indexes and query plans,
modelling from access patterns, and embedding vs referencing with transactions.

| Folder | What | Start here |
|---|---|---|
| [`backend/`](backend/) | The API (Node 22, Express, Mongoose) and everything MongoDB. **This is the focus** | [backend/docs/setup.md](backend/docs/setup.md) |
| [`frontend/`](frontend/) | Optional console (Vite) to call the API and see timings and query plans | [frontend/README.md](frontend/README.md) |

## Quick start

```bash
cd backend
nvm use && npm install
# create .env: see backend/docs/setup.md step 3 (MONGODB_URI, STAGE, JWT_SECRET, ...)
npm run check:setup               # ✅ = Atlas reachable
make test                         # in-memory MongoDB, no Atlas needed
make deploy                       # API in Docker on :3000
TOKEN=$(make -s token)
curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/admin/overview

cd ../frontend && npm install && npm run dev     # console on :5173 (forward this port)
```

## Branches

Each stage builds on the previous one. Check out a stage, read its `EXERCISES.md`, and make the failing tests in `backend/test/exercises/` pass.

| # | Branch | Adds |
|---|---|---|
| 0 | `main` | Setup, skeleton, JWT auth, console, Docker, Makefile |
| 1 | `stage-01-acl-ingest` | Importing from 4 external APIs through an anti-corruption layer |
| 2 | `stage-02-crud-seed-stats` | CRUD, synthetic seeding, storage stats |
| 3 | `stage-03-indexes-search` | Index profiles, `?explain=true`, text search, benchmarks |
| 4 | `stage-04-rentals-modeling` | Rentals: embedding vs referencing, transactions |
| 5 | `stage-05-scale` | Local big runs, document growth demo |

One-time setup

cd backend
nvm use                      # switches to Node 22 (from .nvmrc)
npm install
# .env already exists in backend/ with JWT_SECRET filled in. Fix MONGODB_URI (see below).
npm run check:setup          # ✅ = Atlas reachable and writable

Day to day (backend)

┌──────────────┬────────────────────────────┐
│   Command    │        What it does        │
├──────────────┼────────────────────────────┤
│ make         │ Lists all targets          │
├──────────────┼────────────────────────────┤
│              │ Runs all tests against an  │
│ make test    │ in-memory MongoDB (no      │
│              │ Atlas needed)              │
├──────────────┼────────────────────────────┤
│              │ Syncs entities//shared/,   │
│ make build   │ checks the copies match,   │
│              │ syntax-checks every file   │
├──────────────┼────────────────────────────┤
│              │ Runs the API locally on    │
│ make dev     │ :3000 with auto-restart    │
│              │ (no Docker)                │
├──────────────┼────────────────────────────┤
│              │ Builds movie-store:1.0.0   │
│ make deploy  │ and runs it in Docker on   │
│              │ :3000, then waits for      │
│              │ /health                    │
├──────────────┼────────────────────────────┤
│ make logs    │ Follows the container logs │
├──────────────┼────────────────────────────┤
│ make stop    │ Stops and removes the      │
│              │ container                  │
├──────────────┼────────────────────────────┤
│ make version │ Prints movie-store 1.0.0   │
├──────────────┼────────────────────────────┤
│ make sync /  │ Refreshes or checks the    │
│ make         │ copies inside services     │
│ check-sync   │ (build, test and dev run   │
│              │ these for you)             │
└──────────────┴────────────────────────────┘
