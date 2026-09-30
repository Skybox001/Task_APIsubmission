# Take-Home Assignment — The Untested API

A 2-day take-home assignment. You'll read unfamiliar code, write tests, track down bugs, and ship a small feature.

Read **[ASSIGNMENT.md](./ASSIGNMENT.md)** for the full brief before you start.

---

## My submission

I wrote the test suite first, used it to find the bugs, fixed three of them, and
implemented `PATCH /tasks/:id/assign` on top.

| Deliverable | Where |
|---|---|
| Unit tests | [`task-api/tests/taskService.test.js`](./task-api/tests/taskService.test.js) |
| Integration tests (Supertest) | [`task-api/tests/tasks.routes.test.js`](./task-api/tests/tasks.routes.test.js) |
| Bug report — 8 bugs, 3 fixed | [`BUG_REPORT.md`](./BUG_REPORT.md) |
| Notes, tradeoffs, design decisions | [`SUBMISSION_NOTES.md`](./SUBMISSION_NOTES.md) |
| Deployment config (Render) | [`render.yaml`](./render.yaml) |
| **Live URL** | **https://task-apisubmission.onrender.com** |

> The live instance uses the same in-memory store as local, so **its data resets
> whenever it restarts** (free dynos also sleep when idle, which counts as a
> restart). Anything you create there is fine to poke at, but don't rely on it
> persisting — and it does not share data with a local `npm start`.

### Test results

`npm run coverage` — **68 tests, all passing**, 98.7% statement coverage:

```
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered
-----------------|---------|----------|---------|---------|-----------
All files        |   98.73 |    97.75 |   96.66 |   98.61 |
 src             |   84.61 |       75 |      50 |   84.61 | 17-18  (app.listen)
 src/routes      |     100 |      100 |     100 |     100 |
  tasks.js       |     100 |      100 |     100 |     100 |
 src/services    |     100 |    94.73 |     100 |     100 |
  taskService.js |     100 |    94.73 |     100 |     100 |
 src/utils       |     100 |      100 |     100 |     100 |
  validators.js  |     100 |      100 |     100 |     100 |
```

Every route handler and validator is at 100%. The only uncovered lines are the
`app.listen` callback, which doesn't run under Jest.

### Bugs found and fixed

Found by writing tests, not by reading for bugs. Details in [`BUG_REPORT.md`](./BUG_REPORT.md).

1. **`?status=` filter matched substrings** — `getByStatus` used `t.status.includes(status)`, so `?status=do` returned both `todo` and `done`. Fixed to `===`.
2. **Pagination skipped the first page** — `offset = page * limit` with a 1-indexed API, so `page=1` returned nothing. Fixed to `(page - 1) * limit`; also clamped `page`/`limit` to `>= 1`, since `parseInt('-3') || 1` stayed `-3`.
3. **Completing a task silently reset its priority** — `completeTask` hard-coded `priority: 'medium'`, destroying user data. Removed.

The other five bugs are documented but left unfixed on purpose, each pinned by a
`test.failing` test so the suite stays green and the bug can't regress unnoticed.
That test starts failing the moment someone fixes the bug — which is the signal
to flip it to a plain `test()`.

### New endpoint: `PATCH /tasks/:id/assign`

Live: `PATCH https://task-apisubmission.onrender.com/tasks/<id>/assign`

```bash
curl -X PATCH https://task-apisubmission.onrender.com/tasks/<id>/assign \
  -H "Content-Type: application/json" \
  -d '{"assignee": "Garv"}'
```

Returns the updated task with `assignee` set. Decisions I made:

- **`assignee` must be a string that is non-empty after trimming, max 100 chars** → otherwise **400**. The stored value is trimmed.
- Unknown id → **404**. Validation runs *before* the lookup, matching how `PUT /:id` already behaves.
- **Re-assigning overwrites (200), it does not 409.** A task's owner legitimately changes, and there's no unassign endpoint — a 409 would strand clients. One-line change if the product wants otherwise.
- New tasks now carry `assignee: null` so the task shape stays consistent.

### Note on the docs above

The task shape and API table further down this file (from the original brief) list
statuses as `pending | in-progress | completed`, but the code and `ASSIGNMENT.md`
use `todo | in_progress | done`. **The code is correct** — I followed it and left
the brief's text untouched. Bug #7 in the bug report is the same class of issue.

---

## A note on AI tools

You're welcome to use AI tools. What we're evaluating is your ability to read and reason about unfamiliar code — so your submission should reflect your own understanding, not just generated output.

Concretely:
- For each bug you report: include where in the code it lives and why it happens
- For the feature you implement: briefly explain the design decisions you made
- If something surprised you or you had to make a tradeoff, say so

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
cd task-api
npm install
npm start        # runs on http://localhost:3000
```

**Tests:**

```bash
npm test           # run test suite
npm run coverage   # run with coverage report
```

---

## Project Structure

```
task-api/
  src/
    app.js                  # Express app setup
    routes/tasks.js         # Route handlers
    services/taskService.js # Business logic + in-memory data store
    utils/validators.js     # Input validation helpers
  tests/                    # Your tests go here
  package.json
  jest.config.js
ASSIGNMENT.md               # Full brief — read this first
```

> The data store is in-memory. It resets every time the server restarts.

---

## API Reference

| Method   | Path                      | Description                              |
|----------|---------------------------|------------------------------------------|
| `GET`    | `/tasks`                  | List all tasks. Supports `?status=`, `?page=`, `?limit=` |
| `POST`   | `/tasks`                  | Create a new task                        |
| `PUT`    | `/tasks/:id`              | Full update of a task                    |
| `DELETE` | `/tasks/:id`              | Delete a task (returns 204)              |
| `PATCH`  | `/tasks/:id/complete`     | Mark a task as complete                  |
| `GET`    | `/tasks/stats`            | Counts by status + overdue count         |
| `PATCH`  | `/tasks/:id/assign`       | **Assign a task to a user** _(to implement)_ |

### Task shape

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "pending | in-progress | completed",
  "priority": "low | medium | high",
  "dueDate": "ISO 8601 or null",
  "completedAt": "ISO 8601 or null",
  "createdAt": "ISO 8601"
}
```

### Sample requests

**Create a task**
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write tests", "priority": "high"}'
```

**List tasks with filter**
```bash
curl "http://localhost:3000/tasks?status=pending&page=1&limit=10"
```

**Mark complete**
```bash
curl -X PATCH http://localhost:3000/tasks/<id>/complete
```

---

## What to Submit

See [ASSIGNMENT.md](./ASSIGNMENT.md) for full submission requirements. At minimum, include:

- **Test files** — covering the endpoints and edge cases you identified
- **Bug report** — what you found, where in the code, and why it's a bug (not just symptoms)
- **At least one fix** — with a note on your approach
- **`PATCH /tasks/:id/assign` implementation** — plus a short explanation of any design decisions (validation, edge cases, etc.)
