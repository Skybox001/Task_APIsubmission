# Submission Notes

## What I did
- **Tests:** `task-api/tests/taskService.test.js` (unit) and `tasks.routes.test.js` (Supertest integration). 68 tests, about 99% statement coverage (run `npm run coverage`).
- **Bug report:** see `BUG_REPORT.md`. Eight bugs found, three fixed (status filter, pagination offset, priority reset).
- **Feature:** `PATCH /tasks/:id/assign`.

## Design decisions for `/assign`
- `assignee` must be a string that is non-empty after trimming, max 100 chars, otherwise **400**. The stored name is the trimmed value.
- Unknown task id returns **404**. Validation runs before the lookup, matching how `PUT /:id` already behaves.
- **Already assigned:** allowed, and the new name overwrites the old one (**200**). A task's owner legitimately changes, and there is no unassign endpoint, so a 409 would leave clients stuck. Easy to change if the product wants the opposite.
- New tasks now have `assignee: null` so the task shape is consistent.
- Tests were written alongside the implementation and I confirmed they fail against the original code.

## Tradeoffs
- I fixed three bugs, not one, because they were one-line changes with clear intent. I deliberately left the rest documented with `test.failing` so nothing is hidden and the suite stays green.

## What I would test next
- Concurrency and ordering (the in-memory store is a shared mutable array).
- Very large payloads and unicode or emoji titles.
- Combined filters plus pagination once bug 7 is fixed.
- Contract tests for error response shapes.

## Surprises
- Pagination was off by one page, and `completeTask` quietly overwrote priority, both of which look correct in a quick manual check.
- README and code disagree on status names.

## Questions before production
- Should assignee be a free-text name or a user id from an auth system?
- Should tasks be able to be unassigned, and should assigning notify anyone?
- Is an in-memory store acceptable, or do we need persistence and IDs that survive restarts?
- Should list endpoints return a total count for pagination?
- Any authentication or rate limiting requirements?
