const db = require("../../db");

function toPublic(row) {
  if (!row) return null;
  return { id: row.id, taskId: row.task_id, authorId: row.author_id, body: row.body, createdAt: row.created_at };
}

const insertStmt = db.prepare(`INSERT INTO comments (id, task_id, author_id, body) VALUES (@id, @taskId, @authorId, @body)`);
const findByIdStmt = db.prepare(`SELECT * FROM comments WHERE id = ?`);
const listByTaskStmt = db.prepare(`SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC`);
const deleteStmt = db.prepare(`DELETE FROM comments WHERE id = ?`);

module.exports = {
  create({ id, taskId, authorId, body }) {
    insertStmt.run({ id, taskId, authorId, body });
    return toPublic(findByIdStmt.get(id));
  },
  findById(id) {
    return toPublic(findByIdStmt.get(id));
  },
  listByTask(taskId) {
    return listByTaskStmt.all(taskId).map(toPublic);
  },
  delete(id) {
    deleteStmt.run(id);
  },
};
