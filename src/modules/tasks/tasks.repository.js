const db = require("../../db");

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    columnId: row.column_id,
    priority: row.priority,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const insertStmt = db.prepare(`
  INSERT INTO tasks (id, project_id, title, description, column_id, priority, assignee_id, due_date, position)
  VALUES (@id, @projectId, @title, @description, @columnId, @priority, @assigneeId, @dueDate, @position)
`);
const findByIdStmt = db.prepare(`SELECT * FROM tasks WHERE id = ?`);
const listByProjectStmt = db.prepare(`SELECT * FROM tasks WHERE project_id = ? ORDER BY column_id ASC, position ASC`);
const countInColumnStmt = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE project_id = ? AND column_id = ?`);
const updateFieldsStmt = db.prepare(`
  UPDATE tasks SET
    title = @title,
    description = @description,
    priority = @priority,
    assignee_id = @assigneeId,
    due_date = @dueDate,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = @id
`);
const setColumnAndPositionStmt = db.prepare(`
  UPDATE tasks SET column_id = @columnId, position = @position, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = @id
`);
const setPositionStmt = db.prepare(`UPDATE tasks SET position = @position WHERE id = @id`);
const deleteStmt = db.prepare(`DELETE FROM tasks WHERE id = ?`);

function nextPosition(projectId, columnId) {
  return countInColumnStmt.get(projectId, columnId).n;
}

/**
 * Moves a task to `toColumnId` at `toIndex` among its new column-mates, and
 * re-numbers positions in both the destination column and (if different)
 * the source column so positions stay contiguous (0..n-1). This mirrors
 * the move logic in the Week 2 front end's mock API, now backed by SQL.
 */
function move(id, toColumnId, toIndex) {
  const task = findByIdStmt.get(id);
  if (!task) return null;

  const runMove = db.transaction(() => {
    const siblings = db
      .prepare(`SELECT * FROM tasks WHERE project_id = ? AND column_id = ? AND id != ? ORDER BY position ASC`)
      .all(task.project_id, toColumnId, id);

    const clampedIndex = Math.max(0, Math.min(toIndex, siblings.length));
    siblings.splice(clampedIndex, 0, task);

    siblings.forEach((t, i) => setColumnAndPositionStmt.run({ id: t.id, columnId: toColumnId, position: i }));

    if (task.column_id !== toColumnId) {
      const remainingSource = db
        .prepare(`SELECT * FROM tasks WHERE project_id = ? AND column_id = ? AND id != ? ORDER BY position ASC`)
        .all(task.project_id, task.column_id, id);
      remainingSource.forEach((t, i) => setPositionStmt.run({ id: t.id, position: i }));
    }
  });
  runMove();

  return toPublic(findByIdStmt.get(id));
}

module.exports = {
  create({ id, projectId, title, description = "", columnId = "todo", priority = "medium", assigneeId = null, dueDate = null }) {
    const position = nextPosition(projectId, columnId);
    insertStmt.run({ id, projectId, title, description, columnId, priority, assigneeId, dueDate, position });
    return toPublic(findByIdStmt.get(id));
  },

  findById(id) {
    return toPublic(findByIdStmt.get(id));
  },

  listByProject(projectId) {
    return listByProjectStmt.all(projectId).map(toPublic);
  },

  /** Updates plain fields. If `columnId` is included and differs, the task is appended to the end of that column. */
  update(id, patch) {
    const current = findByIdStmt.get(id);
    if (!current) return null;

    if (patch.columnId !== undefined && patch.columnId !== current.column_id) {
      move(id, patch.columnId, nextPosition(current.project_id, patch.columnId));
    }

    const merged = findByIdStmt.get(id);
    updateFieldsStmt.run({
      id,
      title: patch.title ?? merged.title,
      description: patch.description ?? merged.description,
      priority: patch.priority ?? merged.priority,
      assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : merged.assignee_id,
      dueDate: patch.dueDate !== undefined ? patch.dueDate : merged.due_date,
    });

    return toPublic(findByIdStmt.get(id));
  },

  move,

  delete(id) {
    deleteStmt.run(id);
  },

  toPublic,
};
