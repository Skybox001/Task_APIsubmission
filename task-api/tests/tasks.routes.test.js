// Integration tests for the HTTP API (Supertest against the Express app).
const request = require('supertest');
const app = require('../src/app');
const service = require('../src/services/taskService');

beforeEach(() => service._reset());

const create = async (body = { title: 'Task' }) =>
  (await request(app).post('/tasks').send(body)).body;

describe('POST /tasks', () => {
  test('creates a task (201)', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write tests', priority: 'high', status: 'todo' });
  });

  test.each([
    ['missing title', {}],
    ['empty title', { title: '' }],
    ['whitespace title', { title: '   ' }],
    ['non-string title', { title: 123 }],
    ['bad status', { title: 'x', status: 'pending' }],
    ['bad priority', { title: 'x', priority: 'urgent' }],
    ['bad dueDate', { title: 'x', dueDate: 'not-a-date' }],
  ])('400 on %s', async (_name, body) => {
    const res = await request(app).post('/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  // FIXED (bug #6): falsy-but-invalid values used to skip validation because of
  // `body.status && ...`, so '' was accepted and stored on the task.
  test.each([
    ['empty-string status', { title: 'x', status: '' }],
    ['empty-string priority', { title: 'x', priority: '' }],
    ['null status', { title: 'x', status: null }],
  ])('400 on %s', async (_name, body) => {
    const res = await request(app).post('/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  // dueDate: null means "no due date" in the documented task shape, so it must
  // stay valid even though it is falsy.
  test('accepts dueDate: null', async () => {
    const res = await request(app).post('/tasks').send({ title: 'x', dueDate: null });
    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBeNull();
  });
});

describe('GET /tasks', () => {
  test('lists all tasks', async () => {
    await create({ title: 'A' });
    await create({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('filters by exact status', async () => {
    await create({ title: 'A', status: 'todo' });
    await create({ title: 'B', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.body.map((t) => t.title)).toEqual(['B']);
  });

  test('partial status does not match (bug #1)', async () => {
    await create({ title: 'A', status: 'todo' });
    await create({ title: 'B', status: 'done' });
    expect((await request(app).get('/tasks?status=do')).body).toHaveLength(0);
  });

  describe('pagination', () => {
    beforeEach(async () => { for (let i = 1; i <= 12; i++) await create({ title: `T${i}` }); });

    test('page 1 returns the first items (bug #2)', async () => {
      const res = await request(app).get('/tasks?page=1&limit=5');
      expect(res.body.map((t) => t.title)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
    });

    test('page 2 returns the next items', async () => {
      const res = await request(app).get('/tasks?page=2&limit=5');
      expect(res.body.map((t) => t.title)).toEqual(['T6', 'T7', 'T8', 'T9', 'T10']);
    });

    test('defaults to page 1, limit 10 when only one param is given', async () => {
      expect((await request(app).get('/tasks?page=1')).body).toHaveLength(10);
      expect((await request(app).get('/tasks?limit=3')).body).toHaveLength(3);
    });

    test('garbage, zero and negative values fall back safely', async () => {
      expect((await request(app).get('/tasks?page=abc&limit=xyz')).body).toHaveLength(10);
      const neg = await request(app).get('/tasks?page=-3&limit=-5');
      expect(neg.status).toBe(200);
      expect(neg.body[0].title).toBe('T1');
    });

    test('page beyond the end returns []', async () => {
      expect((await request(app).get('/tasks?page=50&limit=10')).body).toEqual([]);
    });
  });

  // BUG #7: status wins and page/limit are silently ignored when both are sent.
  test.failing('status filter can be combined with pagination', async () => {
    for (let i = 0; i < 5; i++) await create({ title: `D${i}`, status: 'done' });
    const res = await request(app).get('/tasks?status=done&page=1&limit=2');
    expect(res.body).toHaveLength(2);
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const t = await create();
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'New', status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'New', status: 'in_progress' });
  });

  test('404 for unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test.each([
    [{ title: '' }], [{ title: 5 }], [{ status: 'bad' }], [{ priority: 'bad' }], [{ dueDate: 'bad' }],
    [{ status: '' }], [{ priority: '' }], [{ status: 0 }],
  ])('400 on invalid body %j', async (body) => {
    const t = await create();
    expect((await request(app).put(`/tasks/${t.id}`).send(body)).status).toBe(400);
  });

  // BUG #8: setting status via PUT bypasses completedAt bookkeeping.
  test.failing('setting status to done via PUT sets completedAt', async () => {
    const t = await create();
    const res = await request(app).put(`/tasks/${t.id}`).send({ status: 'done' });
    expect(res.body.completedAt).not.toBeNull();
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes (204) and task is gone', async () => {
    const t = await create();
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(204);
    expect((await request(app).get('/tasks')).body).toHaveLength(0);
  });

  test('404 for unknown id', async () => {
    expect((await request(app).delete('/tasks/nope')).status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks complete and preserves priority (bug #3)', async () => {
    const t = await create({ title: 'x', priority: 'high' });
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'done', priority: 'high' });
    expect(res.body.completedAt).not.toBeNull();
  });

  test('404 for unknown id', async () => {
    expect((await request(app).patch('/tasks/nope/complete')).status).toBe(404);
  });

  // FIXED (bug #5): the second call used to re-stamp completedAt. Both calls
  // return 200 and the original completion time survives.
  test('completing twice keeps the first completedAt', async () => {
    const t = await create({ title: 'x' });
    const first = await request(app).patch(`/tasks/${t.id}/complete`);
    await new Promise((r) => setTimeout(r, 15));
    const second = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(second.status).toBe(200);
    expect(second.body.completedAt).toBe(first.body.completedAt);
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts and overdue, and is not shadowed by /:id', async () => {
    await create({ title: 'a', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    await create({ title: 'b', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 0, done: 1, overdue: 1 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a task and returns it', async () => {
    const t = await create();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Garv' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, assignee: 'Garv' });
    expect((await request(app).get('/tasks')).body[0].assignee).toBe('Garv');
  });

  test('new tasks start unassigned', async () => {
    expect((await create()).assignee).toBeNull();
  });

  test('trims whitespace from the name', async () => {
    const t = await create();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: '  Garv  ' });
    expect(res.body.assignee).toBe('Garv');
  });

  test('404 for unknown task', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: 'Garv' });
    expect(res.status).toBe(404);
  });

  test.each([
    ['empty string', { assignee: '' }],
    ['whitespace only', { assignee: '   ' }],
    ['missing', {}],
    ['number', { assignee: 42 }],
    ['null', { assignee: null }],
    ['object', { assignee: { name: 'x' } }],
    ['too long', { assignee: 'x'.repeat(101) }],
  ])('400 when assignee is %s', async (_n, body) => {
    const t = await create();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  test('re-assigning an already assigned task overwrites (200)', async () => {
    const t = await create();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'A' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'B' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('B');
  });

  test('does not change any other field', async () => {
    const t = await create({ title: 'x', priority: 'high', status: 'in_progress' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'A' });
    expect(res.body).toEqual({ ...t, assignee: 'A' });
  });
});

describe('error handling', () => {
  test('malformed JSON body returns an error status, not a crash', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/tasks').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBeGreaterThanOrEqual(400);
    spy.mockRestore();
  });
});
