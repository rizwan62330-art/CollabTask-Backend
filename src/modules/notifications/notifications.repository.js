const db = require("../../db");

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    payload: JSON.parse(row.payload),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

const insertStmt = db.prepare(
  `INSERT INTO notifications (id, user_id, type, payload) VALUES (@id, @userId, @type, @payload)`
);
const findByIdStmt = db.prepare(`SELECT * FROM notifications WHERE id = ?`);
const listForUserStmt = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`);
const markReadStmt = db.prepare(
  `UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = @id AND user_id = @userId`
);
const markAllReadStmt = db.prepare(
  `UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = @userId AND read_at IS NULL`
);

module.exports = {
  create({ id, userId, type, payload }) {
    insertStmt.run({ id, userId, type, payload: JSON.stringify(payload || {}) });
    return toPublic(findByIdStmt.get(id));
  },

  findById(id) {
    return toPublic(findByIdStmt.get(id));
  },

  listForUser(userId) {
    return listForUserStmt.all(userId).map(toPublic);
  },

  markRead(id, userId) {
    const result = markReadStmt.run({ id, userId });
    return result.changes > 0;
  },

  markAllRead(userId) {
    return markAllReadStmt.run({ userId }).changes;
  },
};
