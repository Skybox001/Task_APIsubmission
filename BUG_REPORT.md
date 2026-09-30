# Bug Report: The Untested API

All bugs were found by writing tests first (`task-api/tests/`). Each item lists
expected behaviour, actual behaviour, how it was found, and the fix.
Bugs 1 to 3 are **fixed**. Bugs 4 to 8 are **open**; each has a `test.failing`
test that documents it (the suite stays green now, and that test will start
failing the moment the bug is fixed, which is the cue to change it to `test`).

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

## Open (documented, not fixed)

### 4. Mass assignment on `PUT /tasks/:id`
- **Where:** `taskService.update` spreads the whole body into the task; `validateUpdateTask` never checks unknown keys.
- **Actual:** a client can overwrite `id`, `createdAt`, `completedAt` (and any arbitrary key).
- **Fix:** whitelist `title, description, status, priority, dueDate` (and `assignee`) before merging.

### 5. `PATCH /complete` is not idempotent
- **Where:** `completeTask`.
- **Actual:** completing an already done task overwrites the original `completedAt`.
- **Fix:** if `task.status === 'done'`, return the task unchanged.

### 6. Falsy invalid values bypass validation
- **Where:** `utils/validators.js` uses `body.status && ...` and `body.priority && ...`.
- **Actual:** `status: ''` (or `priority: ''`) passes validation and is stored as an empty string, because the create defaults only apply to `undefined`.
- **Fix:** test `!== undefined` instead of truthiness.

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
