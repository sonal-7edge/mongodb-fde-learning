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
make deploy                       # API in Docker on :3004
TOKEN=$(make -s token)
curl -H "Authorization: Bearer $TOKEN" localhost:3004/api/admin/overview

cd ../frontend && npm install && npm run dev     # console on :5173 (forward this port)
```
One-time setup
```bash
cd backend
nvm use                      # switches to Node 22 (from .nvmrc)
npm install
.env already exists in backend/ with JWT_SECRET filled in. Fix MONGODB_URI (see below).
npm run check:setup          # ✅ = Atlas reachable and writable
```
