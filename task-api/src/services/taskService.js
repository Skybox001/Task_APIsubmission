const { v4: uuidv4 } = require('uuid');

let tasks = [];

const getAll = () => [...tasks];

const findById = (id) => tasks.find((t) => t.id === id);

// FIX (bug #1): was `t.status.includes(status)`, a substring match, so
// ?status=do returned both "todo" and "done". Status must match exactly.
const getByStatus = (status) => tasks.filter((t) => t.status === status);

// FIX (bug #2): pages are 1-indexed in the API (default page=1), but the offset
// was `page * limit`, so page 1 skipped the first `limit` tasks.
const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit;
  return tasks.slice(offset, offset + limit);
};

const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

const create = ({ title, description = '', status = 'todo', priority = 'medium', dueDate = null }) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    completedAt: null,
    assignee: null, // set via PATCH /tasks/:id/assign
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], ...fields };
  tasks[index] = updated;
  return updated;
};

const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;

  // FIX (bug #5): completing a task that is already done re-stamped
  // `completedAt`, so the real completion time was lost on any retry or
  // double-click. Completing is now idempotent — the first stamp wins and
  // re-completing is a no-op that still returns 200 with the task.
  if (task.status === 'done') return task;

  // FIX (bug #3): this used to also reset `priority` to 'medium', silently
  // destroying the user's data. Completing a task must only touch status/completedAt.
  const updated = {
    ...task,
    status: 'done',
    completedAt: new Date().toISOString(),
  };

  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = updated;
  return updated;
};

// Assign (or re-assign) a task to a person. `assignee` is expected to be
// already validated and trimmed by the caller. Returns null if not found.
const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], assignee };
  tasks[index] = updated;
  return updated;
};

const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
