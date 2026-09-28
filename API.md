# CollabTask API Reference

**Base URL:** `http://localhost:4000/api/v1`
**Format:** JSON requests and responses (`Content-Type: application/json`)
**Interactive version:** `http://localhost:4000/api/docs` (Swagger UI) · **Spec:** [`openapi.yaml`](./openapi.yaml)

## Contents

1. [Conventions](#1-conventions): authentication, errors, ids and dates
2. [Auth](#2-auth)
3. [Users](#3-users)
4. [Projects](#4-projects)
5. [Project members](#5-project-members)
6. [Tasks](#6-tasks)
7. [Comments](#7-comments)
8. [Notifications](#8-notifications)
9. [Health](#9-health)
10. [Endpoint summary](#10-endpoint-summary)

---

## 1. Conventions

### Authentication

Every endpoint except `POST /auth/register`, `POST /auth/login`, and
`GET /health` requires a JWT access token, sent as:

```
Authorization: Bearer <token>
```

Tokens are returned by the register and login endpoints and expire after
1 hour by default. A missing, malformed, tampered, or expired token gets a
`401`.

### Roles

Each user has a role **per project**: `owner`, `admin`, or `member`. The
"Requires" line on each endpoint says which roles may call it. Users who
are not members of a project get `403` on everything under it.

### Ids and dates

- All ids are UUIDs. A malformed id in a URL returns `400`; a well-formed id that doesn't exist returns `404`.
- Timestamps (`createdAt`, `updatedAt`, `readAt`) are ISO 8601 UTC strings, e.g. `2026-09-28T05:34:21.170Z`.
- `dueDate` accepts a date (`"2026-10-02"`) or a full ISO timestamp, and is returned exactly as stored.

### Error format

All errors have the same shape:

```json
{
  "error": {
    "message": "The request was invalid.",
    "code": "BAD_REQUEST",
    "details": [
      { "field": "email", "message": "Enter a valid email address." }
    ]
  }
}
```

`details` appears only on validation errors (`400`) and lists **every** invalid field.

| Status | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Validation failed or the JSON body is malformed. |
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired token; wrong login credentials. |
| 403 | `FORBIDDEN` | Authenticated but not allowed (not a project member, or role too low). |
| 404 | `NOT_FOUND` | The resource or route doesn't exist. |
| 409 | `CONFLICT` | Duplicate email, duplicate member, or removing a project's last owner. |
| 429 | `RATE_LIMITED` | Too many login/register attempts (20 per 15 minutes per IP). |
| 500 | `INTERNAL_ERROR` | Unexpected server error. Details are logged server-side only. |

### Allowed values

| Field | Values |
|---|---|
| `columnId` | `todo`, `in_progress`, `review`, `done` |
| `priority` | `low`, `medium`, `high` |
| Project role | `owner`, `admin`, `member` (only `admin` and `member` can be assigned via the API) |
| Notification `type` | `task_assigned`, `comment_added`, `due_soon` |

---

## 2. Auth

### `POST /auth/register`

Create an account. Returns the new user and a token, so the client is logged in immediately.

**Auth:** none · **Rate limited**

**Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 1–120 characters, trimmed |
| `email` | string | yes | Valid email; stored lowercase; must be unique |
| `password` | string | yes | At least 8 characters |

**Example request**

```json
{ "name": "Amina Yusuf", "email": "amina@collabtask.dev", "password": "password123" }
```

**`201 Created`**

```json
{
  "user": {
    "id": "63a1afd2-1038-4604-b3bc-14c7226188cd",
    "name": "Amina Yusuf",
    "email": "amina@collabtask.dev",
    "createdAt": "2026-09-28T05:34:21.170Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:** `400` validation · `409` email already registered · `429` rate limited

---

### `POST /auth/login`

**Auth:** none · **Rate limited**

**Body:** `email` (string, required), `password` (string, required)

**`200 OK`**: same shape as register (`user` + `token`).

**Errors:** `400` validation · `401` "Incorrect email or password." (identical for an unknown email and a wrong password) · `429`

---

### `GET /auth/me`

Returns the user the token belongs to.

**Auth:** required

**`200 OK`**

```json
{ "user": { "id": "63a1afd2-...", "name": "Amina Yusuf", "email": "amina@collabtask.dev", "createdAt": "2026-09-28T05:34:21.170Z" } }
```

**Errors:** `401`

---

## 3. Users

### `GET /users`

Lists all registered users, sorted by name. Used to fill assignee and member pickers.

**Auth:** required

**`200 OK`**

```json
{ "users": [ { "id": "63a1afd2-...", "name": "Amina Yusuf", "email": "amina@collabtask.dev", "createdAt": "..." } ] }
```

---

## 4. Projects

### `GET /projects`

Lists the projects the current user belongs to (newest first), each with task counts for progress bars.

**Auth:** required

**`200 OK`**

```json
{
  "projects": [
    {
      "id": "8fff7836-29a5-46e1-8f7e-7c70eb2e59e5",
      "name": "Website Relaunch",
      "description": "Redesign the marketing site and migrate content to the new CMS.",
      "color": "#3968d8",
      "ownerId": "63a1afd2-1038-4604-b3bc-14c7226188cd",
      "createdAt": "2026-09-28T05:34:21.170Z",
      "total": 7,
      "done": 2
    }
  ]
}
```

---

### `POST /projects`

Creates a project. The caller becomes its `owner`.

**Auth:** required

**Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 1–150 characters |
| `description` | string | no | Up to 2000 characters. Default `""` |
| `color` | string | no | Hex like `#3968d8`. Default `#3968d8` |

**`201 Created`**: `{ "project": { id, name, description, color, ownerId, createdAt } }`

**Errors:** `400`, `401`

---

### `GET /projects/:projectId`

Returns one project with its members.

**Auth:** required · **Requires:** any member

**`200 OK`**

```json
{
  "project": {
    "id": "8fff7836-...",
    "name": "Website Relaunch",
    "description": "...",
    "color": "#3968d8",
    "ownerId": "63a1afd2-...",
    "createdAt": "...",
    "members": [
      { "id": "63a1afd2-...", "name": "Amina Yusuf", "email": "amina@collabtask.dev", "createdAt": "...", "role": "owner" },
      { "id": "9c0e...", "name": "Devon Clarke", "email": "devon@collabtask.dev", "createdAt": "...", "role": "member" }
    ]
  }
}
```

**Errors:** `400` bad id · `401` · `403` not a member · `404`

---

### `PATCH /projects/:projectId`

Partial update: send only the fields to change (`name`, `description`, `color`, same rules as create).

**Auth:** required · **Requires:** `owner` or `admin`

**`200 OK`**: `{ "project": { ... } }`

**Errors:** `400` · `401` · `403` · `404`

---

### `DELETE /projects/:projectId`

Deletes the project and, by cascade, its members, tasks, and comments.

**Auth:** required · **Requires:** `owner`

**`204 No Content`**

**Errors:** `401` · `403` · `404`

---

## 5. Project members

### `POST /projects/:projectId/members`

Adds an existing user to the project.

**Auth:** required · **Requires:** `owner` or `admin`

**Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | string (UUID) | yes | Must be an existing user |
| `role` | string | no | `admin` or `member`. Default `member` |

**`201 Created`**: `{ "members": [ { id, name, email, createdAt, role }, ... ] }` (the full updated list)

**Errors:** `400` · `401` · `403` · `404` project or user not found · `409` already a member

---

### `DELETE /projects/:projectId/members/:userId`

Removes a member.

**Auth:** required · **Requires:** `owner` or `admin`

**`200 OK`**: `{ "members": [ ... ] }` (the remaining members)

**Errors:** `401` · `403` · `404` · `409` "A project must keep at least one owner."

---

## 6. Tasks

A task object:

```json
{
  "id": "5d1c...",
  "projectId": "8fff7836-...",
  "title": "Design new homepage hero",
  "description": "Explore two directions: product-led vs. story-led hero section.",
  "columnId": "in_progress",
  "priority": "high",
  "assigneeId": "63a1afd2-...",
  "dueDate": "2026-09-25",
  "position": 0,
  "createdAt": "2026-09-28T05:34:21.180Z",
  "updatedAt": "2026-09-28T05:34:21.180Z"
}
```

`position` is the zero-based order of the task **within its column**.

### `GET /projects/:projectId/tasks`

All tasks on the project's board, ordered by column then `position`. Group by `columnId` on the client to build the board.

**Auth:** required · **Requires:** any member

**`200 OK`**: `{ "tasks": [ { ... }, ... ] }`

**Errors:** `400` · `401` · `403` · `404`

---

### `POST /projects/:projectId/tasks`

Creates a task at the end of the chosen column. If `assigneeId` is set to someone other than the caller, that user receives a `task_assigned` notification.

**Auth:** required · **Requires:** any member

**Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `title` | string | yes | 1–200 characters |
| `description` | string | no | Up to 5000 characters. Default `""` |
| `columnId` | string | no | See allowed values. Default `todo` |
| `priority` | string | no | See allowed values. Default `medium` |
| `assigneeId` | string (UUID) or `null` | no | Default `null` |
| `dueDate` | date string or `null` | no | Default `null` |

**Example request**

```json
{ "title": "Write launch announcement", "priority": "low", "columnId": "review", "assigneeId": "9c0e...", "dueDate": "2026-10-02" }
```

**`201 Created`**: `{ "task": { ... } }`

**Errors:** `400` · `401` · `403` · `404`

---

### `GET /tasks/:taskId`

**Auth:** required · **Requires:** member of the task's project

**`200 OK`**: `{ "task": { ... } }`

**Errors:** `400` · `401` · `403` · `404`

---

### `PATCH /tasks/:taskId`

Partial update. Send at least one of `title`, `description`, `columnId`, `priority`, `assigneeId`, `dueDate` (same rules as create). Set `assigneeId` or `dueDate` to `null` to clear them.

- Changing `columnId` moves the task to the **end** of the new column. For an exact position, use `/move`.
- Changing `assigneeId` to a different user (not the caller) sends that user a `task_assigned` notification.

**Auth:** required · **Requires:** member of the task's project

**`200 OK`**: `{ "task": { ... } }`

**Errors:** `400` (including an empty body) · `401` · `403` · `404`

---

### `PATCH /tasks/:taskId/move`

Moves a task to an exact column and position, for drag-and-drop. Positions in the destination column (and the source column, if different) are re-numbered so they stay contiguous. An out-of-range `position` is clamped to the end.

**Auth:** required · **Requires:** member of the task's project

**Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `columnId` | string | yes | See allowed values |
| `position` | integer | yes | 0 or greater |

**Example**

```json
{ "columnId": "review", "position": 1 }
```

**`200 OK`**: `{ "task": { ..., "columnId": "review", "position": 1 } }`

**Errors:** `400` · `401` · `403` · `404`

---

### `DELETE /tasks/:taskId`

**Auth:** required · **Requires:** project `owner` or `admin`, **or** the task's assignee

**`204 No Content`**

**Errors:** `400` · `401` · `403` · `404`

---

## 7. Comments

A comment object: `{ "id", "taskId", "authorId", "body", "createdAt" }`.

### `GET /tasks/:taskId/comments`

Comments in chronological order.

**Auth:** required · **Requires:** member of the task's project

**`200 OK`**

```json
{
  "comments": [
    {
      "id": "e7a1...",
      "taskId": "5d1c...",
      "authorId": "63a1afd2-...",
      "body": "First round of concepts are in Figma, would love a look before Friday.",
      "createdAt": "2026-09-28T05:34:21.190Z"
    }
  ]
}
```

---

### `POST /tasks/:taskId/comments`

Adds a comment. If the task has an assignee other than the author, the assignee receives a `comment_added` notification.

**Auth:** required · **Requires:** member of the task's project

**Body:** `body` (string, required, 1–3000 characters after trimming)

**`201 Created`**: `{ "comment": { ... } }`

**Errors:** `400` (empty comment) · `401` · `403` · `404`

---

### `DELETE /comments/:commentId`

**Auth:** required · **Requires:** the comment's author, or project `owner`/`admin`

**`204 No Content`**

**Errors:** `400` · `401` · `403` · `404`

---

## 8. Notifications

A notification object:

```json
{
  "id": "b2f4...",
  "userId": "9c0e...",
  "type": "task_assigned",
  "payload": { "taskId": "5d1c...", "taskTitle": "Design new homepage hero", "projectId": "8fff7836-...", "byUserName": "Amina Yusuf" },
  "readAt": null,
  "createdAt": "2026-09-28T05:34:21.200Z"
}
```

`readAt` is `null` until the notification has been read. You are never notified about your own actions.

### `GET /notifications`

The current user's 50 most recent notifications, newest first.

**Auth:** required

**`200 OK`**: `{ "notifications": [ { ... } ] }`

---

### `PATCH /notifications/:notificationId/read`

Marks one of **your** notifications as read.

**Auth:** required

**`200 OK`**: `{ "notification": { ..., "readAt": "2026-09-28T06:00:00.000Z" } }`

**Errors:** `400` · `401` · `404` (also returned for someone else's notification)

---

### `PATCH /notifications/read-all`

Marks all of your unread notifications as read.

**Auth:** required

**`200 OK`**: `{ "updated": 3 }`

---

## 9. Health

### `GET /health`

**Auth:** none

**`200 OK`**: `{ "status": "ok", "uptime": 123.45, "timestamp": "2026-09-28T05:34:26.943Z" }`

---

## 10. Endpoint summary

| Method | Path | Auth | Min. role | Purpose |
|---|---|---|---|---|
| POST | `/auth/register` | none | — | Create account |
| POST | `/auth/login` | none | — | Log in |
| GET | `/auth/me` | yes | — | Current user |
| GET | `/users` | yes | — | List users |
| GET | `/projects` | yes | — | My projects |
| POST | `/projects` | yes | — | Create project |
| GET | `/projects/:projectId` | yes | member | Project + members |
| PATCH | `/projects/:projectId` | yes | admin | Update project |
| DELETE | `/projects/:projectId` | yes | owner | Delete project |
| POST | `/projects/:projectId/members` | yes | admin | Add member |
| DELETE | `/projects/:projectId/members/:userId` | yes | admin | Remove member |
| GET | `/projects/:projectId/tasks` | yes | member | List tasks |
| POST | `/projects/:projectId/tasks` | yes | member | Create task |
| GET | `/tasks/:taskId` | yes | member | Get task |
| PATCH | `/tasks/:taskId` | yes | member | Update task |
| PATCH | `/tasks/:taskId/move` | yes | member | Move/reorder task |
| DELETE | `/tasks/:taskId` | yes | admin or assignee | Delete task |
| GET | `/tasks/:taskId/comments` | yes | member | List comments |
| POST | `/tasks/:taskId/comments` | yes | member | Add comment |
| DELETE | `/comments/:commentId` | yes | author or admin | Delete comment |
| GET | `/notifications` | yes | — | My notifications |
| PATCH | `/notifications/:notificationId/read` | yes | — | Mark one read |
| PATCH | `/notifications/read-all` | yes | — | Mark all read |
| GET | `/health` | none | — | Health check |
