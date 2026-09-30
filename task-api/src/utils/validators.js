const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// FIX (bug #6): these checks used truthiness (`body.status && ...`), so a falsy
// but invalid value such as '' or 0 or false skipped validation entirely and was
// then stored verbatim — the `create` defaults only kick in for `undefined`, not
// for ''. A task could end up with `status: ''` and still pass every later read.
// Presence is now tested explicitly instead of by truthiness.
//
// `dueDate: null` stays allowed on purpose: the documented task shape uses it to
// mean "no due date", so null is a real value there and not an invalid one.
const validateCommonFields = (body) => {
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate !== undefined && body.dueDate !== null && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const validateCreateTask = (body) => {
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }
  return validateCommonFields(body);
};

const validateUpdateTask = (body) => {
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }
  return validateCommonFields(body);
};

const MAX_ASSIGNEE_LENGTH = 100;

// Returns an error string, or null when valid.
const validateAssign = (body) => {
  const assignee = body && body.assignee;
  if (typeof assignee !== 'string' || assignee.trim() === '') {
    return 'assignee is required and must be a non-empty string';
  }
  if (assignee.trim().length > MAX_ASSIGNEE_LENGTH) {
    return `assignee must be at most ${MAX_ASSIGNEE_LENGTH} characters`;
  }
  return null;
};

module.exports = { validateCreateTask, validateUpdateTask, validateAssign };
