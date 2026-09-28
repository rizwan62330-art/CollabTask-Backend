# CollabTask: Back-End API

REST API for **CollabTask**, the collaborative project and task management
app planned in Week 1 and built as a front end in Week 2. It provides user
authentication, projects with role-based membership, a Kanban-style task
board (with drag-and-drop reordering), comments, and notifications, all
backed by a relational SQLite database.

The API is designed as a drop-in replacement for the Week 2 front end's
`src/api/mockApi.js`: column ids (`todo`, `in_progress`, `review`, `done`),
priorities, and field names match what the UI already expects.

- **Stack:** Node.js 22+, Express 5, better-sqlite3, JSON Web Tokens, Zod
- **Full endpoint reference:** [`API.md`](./API.md)
- **Interactive docs (Swagger UI):** `http://localhost:4000/api/docs` once the server is running
- **Machine-readable spec:** [`openapi.yaml`](./openapi.yaml)

---

## Quick start

Requirements: **Node.js 22 or newer** and npm. No database server needed:
SQLite runs in-process and stores data in a local file.

```bash
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
npm run seed              # optional: load demo data
npm start                 # http://localhost:4000
```

Then try it:

```bash
curl http://localhost:4000/api/v1/health

# log in as a seeded demo user
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"amina@collabtask.dev","password":"password123"}'
```

Copy the `token` from the response and send it on later requests as
`Authorization: Bearer <token>`. Or open the Swagger UI at
`/api/docs`, click **Authorize**, and paste the token to try every
endpoint from the browser.

### Demo accounts (after `npm run seed`)

| Email | Password |
|---|---|
| amina@collabtask.dev | password123 |
| devon@collabtask.dev | password123 |
| priya@collabtask.dev | password123 |
| marco@collabtask.dev | password123 |

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the server. |
| `npm run dev` | Start with automatic restart on file changes (`node --watch`). |
| `npm run seed` | Wipe the database and load demo users, projects, tasks, and comments. |
| `npm test` | Run the automated test suite (Jest + Supertest, in-memory database). |

### Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Port to listen on. |
| `NODE_ENV` | `development` | `development`, `production`, or `test`. In `production` error responses never include stack traces. |
| `JWT_SECRET` | none, **required** | Secret for signing tokens. The server refuses to start without it. Use a long random value outside local development. |
| `JWT_EXPIRES_IN` | `1h` | Token lifetime. |
| `DATABASE_PATH` | `./data/collabtask.sqlite` | SQLite file location (`:memory:` for a throwaway database). |
| `CORS_ORIGIN` | `*` | Browser origin allowed to call the API. Set to the front end's URL in production. |

---

## Design overview

```
Request
  → helmet / CORS / JSON body parser
  → route  →  validate (Zod)  →  requireAuth (JWT)  →  project access check
  → controller  →  repository (SQL via better-sqlite3)
  → JSON response
Any thrown error → central error handler → { "error": { message, code, details? } }
```

### Project structure

```
src/
  app.js              Express app factory (exported for tests)
  server.js           Loads .env and starts listening
  db/
    schema.sql        Relational schema (tables, constraints, indexes)
    index.js          Opens the SQLite connection and applies the schema
  middleware/         auth (JWT), validate (Zod), errorHandler, notFound, rateLimiter
  utils/              AppError, asyncHandler, tokens (JWT), id
  modules/            One folder per resource, each with:
    auth/ users/ projects/ tasks/ comments/ notifications/
      *.routes.js        URL → middleware → controller wiring
      *.controller.js    Request handling and business rules
      *.repository.js    All SQL for that resource
      *.schemas.js       Zod request schemas
scripts/seed.js       Demo data loader
tests/                Jest + Supertest suites
openapi.yaml          OpenAPI 3 spec (powers Swagger UI)
```

### Database schema

Six tables, with foreign keys enforced (`PRAGMA foreign_keys = ON`):

```
users ──< project_members >── projects ──< tasks ──< comments
  │                                          │
  └──< notifications                         └── assignee_id → users (nullable)
```

| Table | Purpose |
|---|---|
| `users` | Accounts. `email` is unique; only a bcrypt hash of the password is stored. |
| `projects` | A board. Has an `owner_id`, a display `color`, and a description. |
| `project_members` | Many-to-many between users and projects, with a `role` (`owner`, `admin`, `member`), unique per (project, user). |
| `tasks` | A card on a project's board: `column_id`, `priority`, `assignee_id`, `due_date`, and `position` for ordering. |
| `comments` | Discussion on a task. |
| `notifications` | Per-user feed (`task_assigned`, `comment_added`); `payload` is JSON text and `read_at` is `NULL` until read. |

Integrity is enforced in the database itself, not only in application code:
`CHECK` constraints restrict `column_id`, `priority`, `role`, and
notification `type` to their allowed values; deleting a project cascades to
its members, tasks, and comments; deleting a user who is a task's assignee
sets `assignee_id` to `NULL` rather than deleting the task. Indexes cover
the foreign keys used in the hot query paths.

`src/db/schema.sql` documents one deliberate simplification against the
Week 1 ER diagram: the separate *workspace* layer is flattened so that
membership lives directly on projects. Reintroducing workspaces later means
adding a `workspace_id` column to `projects` and a workspace-members table;
no other table changes.

### Authentication and authorization

- **Register / login** return a signed JWT (HS256, 1 hour by default).
  Passwords are hashed with **bcrypt** (10 rounds) and never returned by any
  endpoint. Login gives the same `401` for an unknown email and a wrong
  password so it can't be used to discover which emails have accounts.
- **`requireAuth`** verifies the `Authorization: Bearer` header on every
  route except `register`, `login`, and `health`. Tokens for deleted users
  are rejected even if the signature is valid.
- **Authorization** is role-based, per project:

| Action | owner | admin | member |
|---|:-:|:-:|:-:|
| View project, tasks, comments; create/edit/move tasks; comment | yes | yes | yes |
| Edit project details; add or remove members | yes | yes | no |
| Delete project | yes | no | no |
| Delete a task | yes | yes | only if assigned to them |
| Delete a comment | yes | yes | only their own |

Non-members receive `403` for everything on a project. A project can never
be left without an owner (`409`).

### Validation and error handling

Every request body, path parameter, and query is validated with **Zod**
before a controller runs; unknown ids/enums/dates are rejected with a `400`
listing *every* problem at once, not just the first. Errors always use one
shape:

```json
{ "error": { "message": "The request was invalid.", "code": "BAD_REQUEST",
             "details": [{ "field": "email", "message": "Enter a valid email address." }] } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Validation failed, or malformed JSON |
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired token; bad login |
| 403 | `FORBIDDEN` | Authenticated but not permitted (not a member, wrong role) |
| 404 | `NOT_FOUND` | Resource or route doesn't exist |
| 409 | `CONFLICT` | Duplicate email, duplicate member, removing the last owner |
| 429 | `RATE_LIMITED` | Too many login/register attempts |
| 500 | `INTERNAL_ERROR` | Unexpected failure; details are logged server-side, never sent to the client |

### Security measures

- Passwords hashed with bcrypt; secrets read from the environment, and the
  server fails fast if `JWT_SECRET` is missing.
- **Parameterized SQL only** (prepared statements), so there is no SQL injection surface.
- `helmet` sets secure HTTP headers; CORS is configurable; request bodies are capped at 1 MB.
- Login and register are rate-limited (20 requests / 15 minutes per IP).
- Generic auth error messages; no stack traces or SQL in production error responses.
- Object-level authorization: every task and comment lookup resolves back to
  its project and checks membership, so knowing an id is not enough to access it.

### Design decisions worth knowing

- **SQLite via `better-sqlite3`** keeps setup to `npm install`, which suits
  a coursework submission. The repository layer is the only code that
  touches SQL, so moving to PostgreSQL (the production target in the Week 1
  architecture) means rewriting those repository files and the schema
  types, not the controllers or routes.
- **Repository / controller split.** Controllers hold business rules
  (permissions, notifications); repositories hold SQL. Neither leaks into the other.
- **Two ways to change a task's column.** `PATCH /tasks/:id` with a new
  `columnId` appends to the end of that column (what a status dropdown
  needs); `PATCH /tasks/:id/move` takes an exact `position` and re-numbers
  both columns inside a transaction (what drag-and-drop needs).
- **Notifications are created synchronously in the same request.** That's
  enough at this scale; the Week 1 design moves this to a background queue
  and WebSocket push.

---

## Testing

```bash
npm test
```

38 integration tests run the real Express app through Supertest against a
fresh in-memory SQLite database (each test file gets its own), so no
mocks and no cleanup are needed. They cover:

- **Auth:** registration (normalisation, duplicates, validation, malformed JSON), login, identical errors for wrong password vs. unknown email, missing/tampered/expired tokens.
- **Projects and membership:** CRUD, task counts, owner/admin/member permissions, non-member `403`s, duplicate and unknown members, last-owner protection.
- **Tasks:** creation defaults, validation of every field, partial updates, clearing nullable fields, object-level authorization, delete rules.
- **Reordering:** appending on column change, exact-position moves across columns with contiguous positions, clamping out-of-range positions.
- **Comments and notifications:** creation, permissions, who gets notified (and who doesn't), mark-one/mark-all read, isolation between users, cascade deletes.

## Using it with the Week 2 front end

The endpoints line up one-to-one with the mock API functions
(`getProjects` → `GET /projects`, `moveTask` → `PATCH /tasks/:id/move`,
`addComment` → `POST /tasks/:id/comments`, and so on). To connect them,
replace the functions in the front end's `mockApi.js` with `fetch` calls to
this server, set `CORS_ORIGIN` to the front end's dev URL, and add a
login screen that stores the returned token. The front end's existing
loading and error handling already expects promise-based calls.

## Known limitations / next steps

- Single access token; no refresh-token rotation or logout/revocation list.
- SQLite is single-writer; a production deployment would use PostgreSQL.
- Notifications are pull-based (`GET /notifications`); real-time push would need WebSockets.
- No pagination on list endpoints yet (notifications are capped at the latest 50).
- File attachments from the Week 1 design are not implemented.

### Troubleshooting

- **`better-sqlite3` fails to install / "engine" warnings:** this project needs **Node.js 22 or newer** (`node -v`). Use `npm install` (not `npm ci`); the package ships prebuilt binaries, so no C++ compiler is needed.
- **`JWT_SECRET is not set`:** you skipped `cp .env.example .env`.
