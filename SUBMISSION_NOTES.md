# Submission Notes

**Git:** https://github.com/Skybox001/Task_APIsubmission
**Live:** https://task-apisubmission.onrender.com

## What I did
- **Tests:** `task-api/tests/taskService.test.js` and `validators.test.js` (unit) plus `tasks.routes.test.js` (Supertest integration). 116 tests, about 99% statement coverage (run `npm run coverage`).
- **Bug report:** see `BUG_REPORT.md`. Eight bugs found, five fixed (status filter, pagination offset, priority reset, non-idempotent complete, falsy validation bypass).
- **Feature:** `PATCH /tasks/:id/assign`.

## Design decisions for `/assign`
- `assignee` must be a string that is non-empty after trimming, max 100 chars, otherwise **400**. The stored name is the trimmed value.
- Unknown task id returns **404**. Validation runs before the lookup, matching how `PUT /:id` already behaves.
- **Already assigned:** allowed, and the new name overwrites the old one (**200**). A task's owner legitimately changes, and there is no unassign endpoint, so a 409 would leave clients stuck. Easy to change if the product wants the opposite.
- New tasks now have `assignee: null` so the task shape is consistent.
- Tests were written alongside the implementation and I confirmed they fail against the original code.

## Tradeoffs
- I fixed five bugs, not one, because each was a small change with clear intent.
- Bug 6 was fixed in both validators by extracting the three shared checks into one `validateCommonFields` helper. That is a small refactor beyond the strict fix, but the bug existed in two places precisely because the checks were copy-pasted, so I removed the duplication rather than patching it twice.
- I left `dueDate: null` accepted on purpose. It is falsy, so the naive presence check would have started rejecting it, but the documented task shape uses it to mean "no due date". There is a test pinning that.
- The three remaining bugs are documented with `test.failing` so nothing is hidden and the suite stays green.

## What I would test next
- Concurrency and ordering (the in-memory store is a shared mutable array).
- Very large payloads and unicode or emoji titles.
- Combined filters plus pagination once bug 7 is fixed.
- Contract tests for error response shapes.

## Surprises
- Pagination was off by one page, and `completeTask` quietly overwrote priority, both of which look correct in a quick manual check.
- The falsy-validation bug was the one I'd have shipped. `if (body.status && ...)` behaves perfectly for every value you type by hand, so it survives manual testing and only shows up as a bug when a client sends `""` — and then it fails silently rather than loudly, storing an invalid status that `/stats` goes on to ignore.
- The same three validation checks were copy-pasted into both validators, which is why that bug existed in two places at once.
- README and code disagree on status names.

## Questions before production
- Should assignee be a free-text name or a user id from an auth system?
- Should tasks be able to be unassigned, and should assigning notify anyone?
- Is an in-memory store acceptable, or do we need persistence and IDs that survive restarts?
- Should list endpoints return a total count for pagination?
- Any authentication or rate limiting requirements?
