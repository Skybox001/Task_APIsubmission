# Bug Report: The Untested API

All bugs were found by writing tests first (`task-api/tests/`). Each item lists
expected behaviour, actual behaviour, how it was found, and the fix.
Bugs 1 to 3 and 5 to 6 are **fixed**. Bugs 4, 7 and 8 are **open**; each has a
`test.failing` test that documents it (the suite stays green now, and that test
will start failing the moment the bug is fixed, which is the cue to change it to
`test`).

## Fixed

### 1. `?status=` filter uses substring matching
- **Where:** `src/services/taskService.js`, `getByStatus`
- **Expected:** only tasks whose status equals the query.
- **Actual:** `t.status.includes(status)`, so `?status=do` returns both `todo` and `done`, and `?status=in` matches `in_progress`.
- **Found by:** unit test for `getByStatus` with a partial string.
- **Fix:** `t.status === status`.

### 2. Pagination skips the first page
- **Where:** `src/services/taskService.js`, `getPaginated`
- **Expected:** `page=1` returns the first `limit` tasks (the route defaults to page 1, so pages are 1-indexed).
- **Actual:** `offset = page * limit`, so page 1 skips the first `limit` items and page 1 of a 5-item list is empty.
- **Found by:** asserting `page=1&limit=5` returns `T1..T5`.
- **Fix:** `offset = (page - 1) * limit`. Also in `routes/tasks.js` page and limit are now clamped to at least 1, because `parseInt('-3') || 1` stayed `-3` and produced a negative offset (`slice` with a negative index returns wrong data).

### 3. Completing a task resets its priority
- **Where:** `src/services/taskService.js`, `completeTask`
- **Expected:** completing changes only `status` and `completedAt`.
- **Actual:** it also hard-codes `priority: 'medium'`, so a `high` task silently becomes `medium`.
- **Found by:** creating a high priority task, completing it, checking priority.
- **Fix:** removed the `priority` line.

### 5. Completing a task twice loses the completion time
- **Where:** `src/services/taskService.js`, `completeTask`
- **Expected:** `PATCH /complete` is idempotent — the first completion time is the real one, and re-completing is a harmless no-op.
- **Actual:** every call re-stamped `completedAt` with a fresh timestamp, so a retry or double-click overwrote the original completion time.
- **Found by:** completing, waiting 15ms, completing again, and comparing the two timestamps.
- **Fix:** return the task unchanged when `status` is already `done`. Still returns 200 with the task, so clients need no special-casing.

### 6. Falsy invalid values bypass validation
- **Where:** `src/utils/validators.js`, in both `validateCreateTask` and `validateUpdateTask`.
- **Expected:** a value that is present but not valid is rejected.
- **Actual:** the checks were written as `body.status && ...` and `body.priority && ...`, so falsy-but-invalid values (`''`, `0`, `false`, `null`) skipped validation entirely and were then stored verbatim — `create`'s defaults only apply to `undefined`, not `''`. The result was a task with `status: ''` that passed every later read, and `/stats` silently ignored it.
- **Found by:** posting `{"title":"x","status":""}` and getting a 201 back.
- **Fix:** test for presence (`!== undefined`) instead of truthiness. `dueDate: null` is still accepted on purpose, since the documented task shape uses it to mean "no due date". Both validators now share one `validateCommonFields` helper, because the same three checks were duplicated in each and that duplication is what let the bug sit in two places.

## Open (documented, not fixed)

### 4. Mass assignment on `PUT /tasks/:id`
- **Where:** `taskService.update` spreads the whole body into the task; `validateUpdateTask` never checks unknown keys.
- **Actual:** a client can overwrite `id`, `createdAt`, `completedAt` (and any arbitrary key).
- **Fix:** whitelist `title, description, status, priority, dueDate` (and `assignee`) before merging.

### 7. `status` filter and pagination cannot be combined
- **Where:** `routes/tasks.js`, `GET /`. The `status` branch returns early and ignores `page` and `limit`.
- **Fix:** filter first, then paginate the filtered list.

### 8. `PUT` with `status: 'done'` does not set `completedAt`
- **Where:** `taskService.update`.
- **Actual:** `completedAt` stays `null` for a done task, and moving a task back out of `done` does not clear it. Stats and the `/complete` endpoint disagree about what "done" means.
- **Fix:** derive `completedAt` from status changes inside `update`.

## Other observations (not bugs in code)
- `README.md` documents statuses as `pending | in-progress | completed`, but code and `ASSIGNMENT.md` use `todo | in_progress | done`. I followed the code.
- No pagination metadata (total count, total pages) is returned, only a bare array.
- `POST /tasks` silently ignores an `assignee` field in the body, because `create` only destructures the fields it knows about. Harmless while `assignee` is set exclusively through `PATCH /:id/assign`, but it will bite whoever assumes a create can seed an assignment. Worth an explicit rejection rather than a silent drop.
- A request whose `Content-Type` is not `application/json` leaves `req.body` as `undefined`, and the validators then throw a `TypeError` that surfaces as a 500 instead of a 400. The existing malformed-JSON test only asserts `>= 400`, so it does not catch this.
