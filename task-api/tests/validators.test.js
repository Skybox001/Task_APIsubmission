// Unit tests for src/utils/validators.js (called directly, no HTTP).
// Both validators return an error string, or null when the body is valid.
const { validateCreateTask, validateUpdateTask, validateAssign } = require('../src/utils/validators');

describe('validateCreateTask', () => {
  test('accepts a minimal body', () => {
    expect(validateCreateTask({ title: 'Write tests' })).toBeNull();
  });

  test('accepts every valid status and priority', () => {
    for (const status of ['todo', 'in_progress', 'done']) {
      expect(validateCreateTask({ title: 'x', status })).toBeNull();
    }
    for (const priority of ['low', 'medium', 'high']) {
      expect(validateCreateTask({ title: 'x', priority })).toBeNull();
    }
  });

  test.each([
    ['missing title', {}],
    ['empty title', { title: '' }],
    ['whitespace title', { title: '   ' }],
    ['non-string title', { title: 123 }],
  ])('rejects %s', (_name, body) => {
    expect(validateCreateTask(body)).toEqual(expect.any(String));
  });

  test.each([
    ['unknown status', { title: 'x', status: 'pending' }],
    ['unknown priority', { title: 'x', priority: 'urgent' }],
    ['unparseable dueDate', { title: 'x', dueDate: 'not-a-date' }],
  ])('rejects %s', (_name, body) => {
    expect(validateCreateTask(body)).toEqual(expect.any(String));
  });

  // FIXED (bug #6): truthiness checks let these through, and create() then
  // stored them verbatim because its defaults only apply to `undefined`.
  test.each([
    ['empty-string status', { status: '' }],
    ['empty-string priority', { priority: '' }],
    ['zero status', { status: 0 }],
    ['false priority', { priority: false }],
    ['null status', { status: null }],
    ['null priority', { priority: null }],
  ])('rejects falsy-but-invalid %s (bug #6)', (_name, extra) => {
    expect(validateCreateTask({ title: 'x', ...extra })).toEqual(expect.any(String));
  });

  // The documented task shape uses null for "no due date", so it is a real
  // value rather than an invalid one and must stay accepted.
  test('accepts dueDate: null', () => {
    expect(validateCreateTask({ title: 'x', dueDate: null })).toBeNull();
  });

  test('accepts a valid ISO dueDate', () => {
    expect(validateCreateTask({ title: 'x', dueDate: '2026-01-01T00:00:00.000Z' })).toBeNull();
  });
});

describe('validateUpdateTask', () => {
  test('accepts an empty body (every field is optional on update)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  test.each([
    ['empty title', { title: '' }],
    ['whitespace title', { title: '  ' }],
    ['non-string title', { title: 5 }],
    ['unknown status', { status: 'nope' }],
    ['unknown priority', { priority: 'nope' }],
    ['unparseable dueDate', { dueDate: 'nope' }],
  ])('rejects %s', (_name, body) => {
    expect(validateUpdateTask(body)).toEqual(expect.any(String));
  });

  // Same bug as create: update spread the raw body into the task.
  test.each([
    ['empty-string status', { status: '' }],
    ['empty-string priority', { priority: '' }],
    ['null status', { status: null }],
  ])('rejects falsy-but-invalid %s (bug #6)', (_name, body) => {
    expect(validateUpdateTask(body)).toEqual(expect.any(String));
  });

  test('accepts dueDate: null to clear the due date', () => {
    expect(validateUpdateTask({ dueDate: null })).toBeNull();
  });
});

describe('validateAssign', () => {
  test('accepts a normal name', () => {
    expect(validateAssign({ assignee: 'Garv' })).toBeNull();
  });

  test('accepts a name that only needs trimming', () => {
    expect(validateAssign({ assignee: '  Garv  ' })).toBeNull();
  });

  test.each([
    ['missing', {}],
    ['empty string', { assignee: '' }],
    ['whitespace only', { assignee: '   ' }],
    ['number', { assignee: 42 }],
    ['null', { assignee: null }],
    ['object', { assignee: { name: 'x' } }],
    ['array', { assignee: ['x'] }],
  ])('rejects %s', (_name, body) => {
    expect(validateAssign(body)).toEqual(expect.any(String));
  });

  test('accepts exactly the max length and rejects one more', () => {
    expect(validateAssign({ assignee: 'x'.repeat(100) })).toBeNull();
    expect(validateAssign({ assignee: 'x'.repeat(101) })).toEqual(expect.any(String));
  });

  test('measures length after trimming', () => {
    expect(validateAssign({ assignee: '  ' + 'x'.repeat(100) + '  ' })).toBeNull();
  });

  test('does not throw on a missing body', () => {
    expect(validateAssign(undefined)).toEqual(expect.any(String));
  });
});