# Walkthrough: from boot to query plan

A presenter's script. Each step names the **concept**, the **code to show**, and **what to say**.
Parts 1–4 explain how the app works; parts 5–6 are live demos you run with `curl`.

| Part | Topic | Time |
|---|---|---|
| 1 | Startup: one shared connection | 5 min |
| 2 | Entities: how we define a collection | 10 min |
| 3 | One request, `GET /api/rentals/:id` | 10 min |
| 4 | Writes: atomic updates and transactions | 5 min |
| 5 | Demo: seed 100k movies, then fix a slow search with an index | 15 min |
| 6 | Demo: embedding and referencing in rentals | 10 min |

---

## Part 1 — Startup (runs once)

**1. Load config.** `server.js` loads `.env` and stops if `MONGODB_URI` or `STAGE` is missing.
Say: *"Fail at boot, not on the first request."*

**2. Build the app.** `buildApp()` in `app.js` registers every route; requiring the routes loads the models.
Say: *"Models exist before the connection. That's fine: Mongoose queues queries until it connects."*

**3. Connect once.** `server.js`:
```js
await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 20, serverSelectionTimeoutMS: 10_000 })
```
- **One pool for the whole app.** Up to 20 sockets to Atlas, shared by every request. Opening a connection per request would be slow and Atlas caps connections.
- **Nothing is passed down.** Node caches modules, so every `require('mongoose')` returns the same object. `connect()` sets up its default connection, and `mongoose.model()` attaches models to it.
- **No `const client =`.** `mongoose.connect()` returns `mongoose` itself. Only the raw driver needs you to keep a `MongoClient`. The parts underneath are `mongoose.connection`, `.db` and `.getClient()`.
- **Options.** `maxPoolSize`: how many queries can run at once; the rest wait. `serverSelectionTimeoutMS`: if Atlas can't be reached within 10 s, `connect()` fails and the process exits instead of hanging.

**4. Listen, and shut down cleanly.** `app.listen` runs only after the connect succeeds. On SIGTERM: stop accepting requests, then `mongoose.disconnect()`.

---

## Part 2 — Entities (how we define a collection)

Use `entities/Rental.js` as the example; `Movie.js` and `Employee.js` follow the same layout.

**E1. One source of truth, copied into each service.** Edit only root `entities/` and `shared/`; `make sync` copies them read-only into `services/*/`, and `make check-sync` fails if a copy has changed.
Say: *"Each service runs on its own, so each needs the models in its own folder."*

**E2. JSDoc `@typedef` first.** It describes the shape and, for each field, why it is embedded or referenced. The editor uses it for autocomplete.

**E3. Sections in a fixed order.** `Basic`, `Movie`, `Employee`, `Customer`, `Pricing`, `Event`, `Dates`, `Audit`. Same order in every entity.

**E4. Four ways to model related data**, the key slide:

| Field | Pattern | Why |
|---|---|---|
| `movie: { _id, title, kind, year }` | Extended reference | Id + a copy of the fields lists show. Reading a rental needs no `$lookup`. A snapshot at rent time. |
| `employee: { _id, name, employee_code }` | Extended reference | Same, for the employee who served the rental. |
| `customer: { name, email, phone }` | Embedded 1:1 | Belongs only to this rental and is never queried on its own. |
| `pricing: { daily_rate, days, total, currency }` | Embedded, computed once | Fixed at rent time; later price changes don't affect old rentals. |
| `events: [...]` | Bounded array | History inside the document, capped at `MAX_RENTAL_EVENTS = 5` so it can't grow toward the 16 MB document limit. |

Rule of thumb: *data you read together, store together. Reference what has a life of its own; copy only fields you show and that rarely change.*

**E5. Types and rules.** `Schema.Types.ObjectId`, `required`, `enum`, `min`, `lowercase`/`trim`. The schema is the last check after Joi. `_id` is an ObjectId here, which is why routes convert the URL string (Part 3, step 7).

**E6. Defaults.** Pass a function (`Date.now`, `() => randomUUID()`) to get a fresh value per document; a plain value is computed once, when the file loads.

**E7. Audit fields and soft delete.** `created_by` / `updated_by` come from the JWT (`req.auth.sub`). `deleted: true` hides a document; every query filters `{ deleted: false }`.

**E8. Options and plugin.** `timestamps` with snake_case names; `mongoose-paginate-v2` adds `Model.paginate()`.

**E9. Register the model.** `mongoose.model(\`${STAGE}-rentals\`, schema)`. The stage prefix keeps dev and prod apart on one cluster. Registering attaches the model to the default connection from step 3.

---

## Part 3 — One request: `GET /api/rentals/:id`

**5. Route and middleware.** `app.js`: `auth` → `validate(...)` → `getRental`. Each one either calls `next()` or sends an error.

**6. Validate with Joi.** `utils/joi_schema.js`: `id` must be 24 hex characters. A bad id gets a 400 before it reaches the database. Clean values go on `req.valid` (Express 5 makes `req.query` read-only).

**7. Decode and convert the id.** `routes/get.js`:
```js
const _id = new mongoose.Types.ObjectId(decodeURIComponent(req.valid.params.id))
```
- `decodeURIComponent` turns `%xx` back into characters; for a hex id it changes nothing but makes the step visible.
- A string `'65f…'` and `ObjectId('65f…')` are different values to MongoDB. Mongoose would convert it quietly; the native driver and `aggregate()` pipelines would not. Converting it ourselves works the same everywhere. Every by-id route does this.

**8. Query.** `Rental.findOne({ _id, deleted: false }).lean()`. `.lean()` returns plain objects (faster for reads). `?explain=true` returns the plan: an `_id` lookup never scans the collection.

**9. One read, no join.** The response already contains the movie title and employee name, from the snapshot (E4).

**10. Errors in one place.** `throw new HttpError(404)` → `next(error)` → `errorHandler`: Joi/CastError → 400, duplicate key → 409, `maxTimeMS` exceeded → 504, HttpError → its status, else 500. No stack traces to the client.

---

## Part 4 — Writes

**11. Atomic update.** `movie_store/routes/findOneAndUpdate.js`: the stock rule (`available > 0`) is in the filter and `$inc` changes it in the same operation, so two requests can never both take the last copy.

**12. Transaction.** `rentals/routes/rent.js` / `return.js`: `mongoose.startSession()` → `withTransaction`. Rental and movie stock change together, or neither does. The session comes from the same pool as step 3.

---

## Part 5 — Demo: a slow search at scale, fixed with an index

The story: *"With a few movies, any query is fast. With 100,000, a title search has to read every movie. We'll watch it get slow, make it fail under a time limit, then add one index and watch it drop to reading one document."*

### Setup (once)

```bash
cd backend
make dev                              # terminal 1: server on :3004
TOKEN=$(make -s token)                # terminal 2
H="Authorization: Bearer $TOKEN"
```

### Step 5.1 — Seed lots of data

```bash
curl -s -X POST localhost:3004/api/movies/admin/seed -H "$H" -H 'Content-Type: application/json' \
  -d '{"count": 100000, "batch_size": 1000, "seed": 42}' | jq
```
Explain, pointing at `routes/seed.js` and `shared/seed.js`:
- **Batches.** 100 `insertMany` calls of 1,000, not one call of 100,000. Memory stays flat and each batch is one round trip.
- **`ordered: false`.** One bad document doesn't stop the rest of the batch.
- **Repeatable.** `faker.seed(42)`: the same seed always produces the same movies, so everyone sees the same results.
- **Budget check.** Before inserting, it projects the size against 80% of the Free tier's 0.5 GB and refuses with 507 if over. `SEED_MAX` (default 100,000) caps one call.
- Show the response: `inserted`, `ms`, `docs_per_sec`, `budget.projected_bytes`.

Check what's there:
```bash
curl -s localhost:3004/api/admin/overview -H "$H" | jq '.collections[] | {collection, count, dataSize, totalIndexSize}'
curl -s localhost:3004/api/movies/admin/indexes -H "$H" | jq   # only _id_
```
Say: *"Only `_id_` exists. MongoDB creates that one for us; every other index we add on purpose."*

### Step 5.2 — Search by title without an index

Pick a real title to search for:
```bash
curl -s "localhost:3004/api/movies?limit=1" -H "$H" | jq -r '.data[0].title'      # e.g. "Complicated Earth"
```
Search by its first few letters:
```bash
curl -s "localhost:3004/api/movies/by-title?title=Complicated%20Ea&explain=true" -H "$H" | jq '.plan'
```
Expected:
```json
{ "stage": "COLLSCAN", "docsExamined": 100000, "nReturned": 1, "hasSortStage": true, "ms": 80 }
```
Explain, pointing at `routes/findByTitle.js`:
- The filter is `{ title: { $regex: '^Complicated Ea' } }`, a **prefix** search (anchored with `^`).
- **COLLSCAN** = MongoDB read **all 100,000** movies to return 1. `docsExamined` is the number to watch.
- **`hasSortStage: true`** = it also sorted the matches in memory, because nothing was already in title order.
- The cost grows with the collection: 10× the movies → 10× the work.

### Step 5.3 — Make it fail

Real apps put a time limit on queries. Give this one 30 ms:
```bash
curl -s "localhost:3004/api/movies/by-title?title=Complicated%20Ea&max_time_ms=30" -H "$H" | jq
```
Expected: **HTTP 504** `{ "error": "Query took too long and was stopped (maxTimeMS)" }`
Say: *"MongoDB stopped the query (error code 50, MaxTimeMSExpired) and `shared/errors.js` turned it into a 504. Under real load, with many users searching at once, every one of those scans competes for the same CPU and cache; this is how a search page falls over."*

### Step 5.4 — Add the index

```bash
curl -s -X POST localhost:3004/api/movies/admin/indexes/title -H "$H" | jq
```
Explain, pointing at `utils/indexes.js` and `routes/createIndex.js`:
- The index is `{ title: 1 }`: a sorted list of every title with a pointer to its document, like the index at the back of a book.
- Indexes are **never** created at app startup. Each one is added on purpose, for one named access pattern (`access_pattern` in the response).
- `ms` = build time: MongoDB read the whole collection once to build it.

```bash
curl -s localhost:3004/api/movies/admin/indexes -H "$H" | jq   # title_1 appears, with size_bytes
```
Say: *"An index isn't free. It takes space (`size_bytes`, about 1.5 MB here) and every insert or title change must update it too."*

### Step 5.5 — Search again

```bash
curl -s "localhost:3004/api/movies/by-title?title=Complicated%20Ea&explain=true" -H "$H" | jq '.plan'
curl -s "localhost:3004/api/movies/by-title?title=Complicated%20Ea&max_time_ms=30" -H "$H" | jq '.data | length'
```
Expected:
```json
{ "stage": "IXSCAN", "indexName": "title_1", "docsExamined": 1, "keysExamined": 2, "hasSortStage": false, "ms": 0 }
```
and the time-limited query now returns 200.

The before/after slide:

| | Without index | With `{ title: 1 }` |
|---|---|---|
| stage | COLLSCAN | IXSCAN |
| docsExamined | 100,000 | 1 |
| in-memory sort | yes | no (index is already in title order) |
| ms | ~80 (local), more on Atlas M0 | 0 |
| with `max_time_ms=30` | 504 | 200 |

### Step 5.6 — Where the index does not help (questions to expect)

- **Middle of the title** (`/Earth/`) or **case-insensitive** (`/^complicated/i`): MongoDB can't jump to a range in the index, so it scans every key. A prefix search with the exact case is the shape this index serves. Full-word search needs a text index (next stage).
- **Drop it to show the "before" again:** `curl -s -X DELETE localhost:3004/api/movies/admin/indexes/title -H "$H"`

---

## Part 6 — Demo: embedding and referencing in rentals

Uses the movies from Part 5. Seed some employees first:
```bash
curl -s -X POST localhost:3004/api/employees/admin/seed -H "$H" -H 'Content-Type: application/json' -d '{"count": 50}' | jq '.inserted'
MOVIE=$(curl -s "localhost:3004/api/movies?limit=1" -H "$H" | jq -r '.data[0]._id')
EMP=$(curl -s "localhost:3004/api/employees?limit=1" -H "$H" | jq -r '.data[0]._id')
```

### Step 6.1 — Rent a movie, then look at the document

```bash
RENTAL=$(curl -s -X POST localhost:3004/api/rentals -H "$H" -H 'Content-Type: application/json' \
  -d "{\"movie_id\":\"$MOVIE\",\"employee_id\":\"$EMP\",\"customer\":{\"name\":\"Asha Rao\",\"email\":\"asha@example.com\"},\"days\":3}" \
  | jq -r '.data._id')
curl -s localhost:3004/api/rentals/$RENTAL -H "$H" | jq '.data | {movie, employee, customer, pricing, events}'
```
Walk the output field by field against the E4 table:
- `movie` and `employee`: **extended references**: `_id` plus a few copied fields.
- `customer` and `pricing`: **embedded**, owned by this rental.
- `events`: one `rented` event, the start of the bounded history.

### Step 6.2 — One read, no join

```bash
curl -s "localhost:3004/api/rentals/$RENTAL?explain=true" -H "$H" | jq '.plan'
```
Say: *"One `_id` lookup, one document examined, and the screen has the movie title and employee name. With plain references we'd need a second and third query, or a `$lookup`."*

### Step 6.3 — The reference still works for queries

```bash
curl -s "localhost:3004/api/rentals?movie_id=$MOVIE" -H "$H" | jq '{total_docs, titles: [.data[].movie.title]}'
```
Say: *"`movie._id` lives inside the snapshot, so 'all rentals of this movie' is a plain filter on `movie._id`, not a join."*

### Step 6.4 — The other side of the reference: the movie document

```bash
curl -s localhost:3004/api/movies/$MOVIE -H "$H" | jq '.data | {title, inventory, stats}'
```
Say: *"The movie stays its own document. Renting changed it with `$inc` inside the same transaction: `inventory.available` went down by 1, `stats.rental_count` up by 1. We don't push rentals into the movie, because a popular movie would grow without limit."*

### Step 6.5 — Snapshots don't follow changes (on purpose)

```bash
curl -s -X PATCH localhost:3004/api/movies/$MOVIE -H "$H" -H 'Content-Type: application/json' -d '{"title":"Renamed Movie"}' > /dev/null
curl -s localhost:3004/api/movies/$MOVIE  -H "$H" | jq -r '.data.title'        # Renamed Movie
curl -s localhost:3004/api/rentals/$RENTAL -H "$H" | jq -r '.data.movie.title' # still the old title
```
Discuss: *"A rental is a record of what happened, so the title at rent time is correct. If the copy had to stay current, we'd either `updateMany` the rentals on `movie._id` when a title changes, or not copy the title and `$lookup` it instead. That's the trade-off: copy for fast reads, at the price of keeping copies up to date."*

### Step 6.6 — The bounded array

```bash
curl -s -X POST localhost:3004/api/rentals/$RENTAL/return -H "$H" | jq '.data | {status, returned_at, events}'
```
Say: *"The return added a second event in the same transaction that put the copy back. The schema rejects a 6th event (`MAX_RENTAL_EVENTS = 5`), so the document size stays bounded."*

---

**Close with:** *Define the shape once and copy it to every service. Embed what you read together, reference what lives on its own. Connect once and share the pool. Check input at the edge, convert ids to their real type, give every frequent query an index, handle errors in one place, and make multi-document writes atomic or transactional.*
