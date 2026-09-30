// Unit tests for src/services/taskService.js (called directly, no HTTP).
// Tests marked test.failing document KNOWN, UNFIXED bugs (see BUG_REPORT.md):
// they pass while the bug exists and will start failing once it is fixed,
// which is the signal to flip them to plain test(). Bug #4 (mass assignment
// on update) is the only one still in that state.
const service = require('../src/services/taskService');

beforeEach(() => service._reset());

const make = (over = {}) => service.create({ title: 'Task', ...over });

describe('create / getAll / findById', () => {
  test('applies defaults', () => {
    const t = make();
    expect(t).toMatchObject({
      title: 'Task', description: '', status: 'todo', priority: 'medium',
      dueDate: null, completedAt: null, assignee: null,
    });
    expect(t.id).toEqual(expect.any(String));
    expect(new Date(t.createdAt).toString()).not.toBe('Invalid Date');
  });

  test('getAll returns a copy, not the internal array', () => {
    make();
    service.getAll().push({ fake: true });
    expect(service.getAll()).toHaveLength(1);
  });

  test('findById returns the task or undefined', () => {
    const t = make();
    expect(service.findById(t.id)).toEqual(t);
    expect(service.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  test('returns only exact matches', () => {
    make({ status: 'todo' });
    make({ status: 'done' });
    expect(service.getByStatus('todo')).toHaveLength(1);
  });

  test('regression: partial status must NOT match (bug #1)', () => {
    make({ status: 'todo' });
    make({ status: 'done' });
    expect(service.getByStatus('do')).toHaveLength(0);
  });

  test('unknown status returns empty list', () => {
    make();
    expect(service.getByStatus('nope')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => { for (let i = 1; i <= 25; i++) make({ title: `T${i}` }); });

  test('page 1 starts at the first task (bug #2)', () => {
    const r = service.getPaginated(1, 10);
    expect(r).toHaveLength(10);
    expect(r[0].title).toBe('T1');
  });

  test('page 3 returns the remaining tasks', () => {
    const r = service.getPaginated(3, 10);
    expect(r.map((t) => t.title)).toEqual(['T21', 'T22', 'T23', 'T24', 'T25']);
  });

  test('page past the end returns empty list', () => {
    expect(service.getPaginated(99, 10)).toEqual([]);
  });
});

describe('getStats', () => {
  test('counts by status and overdue', () => {
    make({ status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' }); // overdue
    make({ status: 'in_progress', dueDate: '2999-01-01T00:00:00.000Z' }); // future
    make({ status: 'done', dueDate: '2000-01-01T00:00:00.000Z' }); // done is never overdue
    make({ status: 'todo' }); // no due date
    expect(service.getStats()).toEqual({ todo: 2, in_progress: 1, done: 1, overdue: 1 });
  });

  test('empty store gives zeros', () => {
    expect(service.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });
});

describe('update', () => {
  test('merges fields and persists', () => {
    const t = make();
    const u = service.update(t.id, { title: 'New', priority: 'high' });
    expect(u).toMatchObject({ title: 'New', priority: 'high', status: 'todo' });
    expect(service.findById(t.id).title).toBe('New');
  });

  test('returns null for unknown id', () => {
    expect(service.update('nope', { title: 'x' })).toBeNull();
  });

  // BUG #4: fields are spread straight into the task (mass assignment).
  test.failing('must not allow overwriting id/createdAt/completedAt', () => {
    const t = make();
    const u = service.update(t.id, { id: 'hacked', createdAt: '1999-01-01', completedAt: 'x' });
    expect(u.id).toBe(t.id);
    expect(u.createdAt).toBe(t.createdAt);
    expect(u.completedAt).toBeNull();
  });
});

describe('remove', () => {
  test('removes an existing task', () => {
    const t = make();
    expect(service.remove(t.id)).toBe(true);
    expect(service.getAll()).toHaveLength(0);
  });

  test('returns false for unknown id', () => {
    expect(service.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status done and completedAt', () => {
    const t = make();
    const c = service.completeTask(t.id);
    expect(c.status).toBe('done');
    expect(new Date(c.completedAt).toString()).not.toBe('Invalid Date');
  });

  test('keeps priority unchanged (bug #3)', () => {
    const t = make({ priority: 'high' });
    expect(service.completeTask(t.id).priority).toBe('high');
  });

  test('returns null for unknown id', () => {
    expect(service.completeTask('nope')).toBeNull();
  });

  // FIXED (bug #5): completing twice used to overwrite completedAt, losing the
  // real completion time. The first stamp must win.
  test('is idempotent: completedAt keeps the first completion time', async () => {
    const t = make();
    const first = service.completeTask(t.id);
    await new Promise((r) => setTimeout(r, 15));
    const second = service.completeTask(t.id);
    expect(second.completedAt).toBe(first.completedAt);
  });

  test('re-completing a done task leaves the rest of the task untouched', async () => {
    const t = make({ title: 'x', priority: 'low' });
    service.assignTask(t.id, 'Garv');
    const first = service.completeTask(t.id);
    const second = service.completeTask(t.id);
    expect(second).toEqual(first);
    expect(second).toMatchObject({ title: 'x', priority: 'low', assignee: 'Garv' });
  });
});

describe('assignTask', () => {
  test('stores assignee and persists it', () => {
    const t = make();
    const a = service.assignTask(t.id, 'Garv');
    expect(a.assignee).toBe('Garv');
    expect(service.findById(t.id).assignee).toBe('Garv');
  });

  test('re-assigning overwrites the previous assignee', () => {
    const t = make();
    service.assignTask(t.id, 'A');
    expect(service.assignTask(t.id, 'B').assignee).toBe('B');
  });

  test('returns null for unknown id', () => {
    expect(service.assignTask('nope', 'A')).toBeNull();
  });
});
