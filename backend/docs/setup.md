# Setup (pre-work)

Do this before the session. It takes about 20 minutes. When `npm run check:setup` prints ✅ you are ready.

## 1. Tools

| Tool | Version | Check |
|---|---|---|
| Node.js | 22 LTS (22.12 or newer) | `node -v` |
| make, rsync, curl | any | `make -v`, `rsync --version`, `curl --version` |
| Docker | 24+ with Compose v2 | `docker version` |
| git | any | `git --version` |

Node 20 reached end of life in April 2026 and the test runner (Vitest 5) needs Node 22. With nvm:

```bash
nvm install 22 && nvm use      # backend/.nvmrc says 22
```

## 2. MongoDB Atlas (Free tier, M0)

1. Sign in at <https://cloud.mongodb.com> and create a project.
2. **Create a cluster** → choose **M0 (Free)** → any region close to you.
3. **Database Access** → add a database user with a password (role: *Read and write to any database*).
4. **Network Access** → *Add IP address* → *Add current IP address*.
5. **Database → Connect → Drivers** → copy the `mongodb+srv://...` connection string.
   Add a database name before the `?`, e.g. `...mongodb.net/movie_store?retryWrites=true&w=majority`.

Free tier limits this app is designed around:

| Limit | What you will notice |
|---|---|
| 0.5 GB data + indexes | Seed endpoints refuse to go past 80% of it |
| Operations per second are throttled | Timings are noisy, so we compare `docsExamined`, not milliseconds |
| 32 MB in-memory sort | An unindexed sort on a big collection can fail |
| 500 connections | The app uses one connection pool |
| 3-node replica set | Transactions work |

All commands below run in the `backend/` folder.

## 3. Configure

Create `backend/.env` with these variables:

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/movie_store?retryWrites=true&w=majority
STAGE=dev
PORT=3004
ATLAS_FREE_TIER=true
SEED_MAX=100000
JWT_SECRET=<at least 32 characters, see below>
JWT_EXPIRES_IN=1h
DEV_TOKEN_ENDPOINT=true
```

Generate the JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Edit `.env`: paste the Atlas string into `MONGODB_URI`. **No quotes around values** (Docker reads them literally).
URL-encode special characters in the password (`@` → `%40`, `#` → `%23`).

Set `STAGE` (for example `STAGE=dev`). Every collection name starts with it: `dev-movies`, `dev-employees`, `dev-rentals`.

## 4. Install and check

```bash
npm install
npm run check:setup     # ✅ = Atlas is reachable and writable
make test               # runs against an in-memory MongoDB; no Atlas needed
```

If `check:setup` fails:

| Error | Fix |
|---|---|
| `querySrv ENOTFOUND` | Corporate DNS/VPN blocks SRV lookups. Try another network, or use the standard `mongodb://` string from Atlas |
| `Authentication failed` | Check user/password; URL-encode special characters in the password |
| `Server selection timed out` | Your IP is missing in Atlas Network Access, or a VPN/firewall blocks port 27017 |
| `MONGODB_URI is missing` | Create `backend/.env` as shown in step 3 |

## 5. Run it

```bash
make deploy                       # builds movie-store:<version> and runs it on :3004
curl localhost:3004/health        # no token needed

TOKEN=$(make -s token)            # signed with JWT_SECRET from .env, valid for JWT_EXPIRES_IN
curl -H "Authorization: Bearer $TOKEN" localhost:3004/api/admin/overview
```

Without the header every `/api/*` call returns `401`.

## 6. The console (optional)

The Vite console in `frontend/` shows each call's round trip, server time and MongoDB query plan.
See [frontend/README.md](../../frontend/README.md). In short: `cd frontend && npm install && npm run dev`,
then open <http://localhost:5173> (forward only that port on a remote machine).
