# Movie Store Console (frontend)

A small Vite app for calling the Movie Store API and seeing **how long each call takes** and **what
MongoDB did** (query plan). It's plain JavaScript with no framework, and it has no user accounts:
one button gets an access token.

It's fully separate from `backend/`: it only talks to the API over HTTP.

## Run

The API must be running first (from `backend/`: `make deploy`).

```bash
cd frontend
nvm use            # Node 22
npm install
npm run dev        # http://localhost:5173
```

Working on a remote machine? Forward **only port 5173**. Vite forwards `/api`, `/auth` and
`/health` to the API, so the browser never needs port 3004 and no CORS setup is needed.

```bash
ssh -L 5173:localhost:5173 you@remote-host      # or the "Ports" tab in VS Code
```

| Variable | Default | Use |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3004` | Where the API runs |
| `UI_ALLOWED_HOSTS` | (none) | Comma-separated hostnames, if you open the UI through a forwarding hostname such as `*.devtunnels.ms` |

## Use

1. **Generate token** calls `POST /auth/token` (the API must have `DEV_TOKEN_ENDPOINT=true`).
   The token is kept in this browser tab only (sessionStorage).
2. Pick an endpoint on the left, tick `?explain=true` where it's offered, and press **Send**.
   Use **Repeat N times** to get min/avg/max timings.

| Number | Where it comes from | What it includes |
|---|---|---|
| Round trip | Measured in the browser | Network + Vite proxy + API + MongoDB |
| Server | `Server-Timing` response header | Time inside the API (Express + MongoDB) |
| MongoDB | `plan.ms` (`executionTimeMillis`) | Time MongoDB spent running the query |

The **query plan** panel shows the stage (COLLSCAN = read every document, IXSCAN = used an index), the index
name, `docsExamined`, `keysExamined`, and whether the sort happened in memory. The history table keeps the
last 20 calls so you can compare before and after adding an index.

## Files

| File | What it does |
|---|---|
| `src/endpoints.js` | The list of endpoints. Each backend stage adds its endpoints here |
| `src/api.js` | `fetch` wrapper that measures timing and reads `Server-Timing` |
| `src/main.js` | Token, endpoint list, sending, results, history |
| `vite.config.js` | Dev server on 5173 and the proxy to the API |
