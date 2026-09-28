const db = require("../../db");

function toPublic(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

const insertStmt = db.prepare(
  `INSERT INTO users (id, name, email, password_hash) VALUES (@id, @name, @email, @passwordHash)`
);
const findByEmailStmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
const findByIdStmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
const listAllStmt = db.prepare(`SELECT * FROM users ORDER BY name ASC`);

module.exports = {
  create({ id, name, email, passwordHash }) {
    insertStmt.run({ id, name, email, passwordHash });
    return toPublic(findByIdStmt.get(id));
  },

  /** Returns the raw row (including password_hash) — only for password comparison during login. */
  findByEmailRaw(email) {
    return findByEmailStmt.get(email);
  },

  findById(id) {
    return toPublic(findByIdStmt.get(id));
  },

  listAll() {
    return listAllStmt.all().map(toPublic);
  },

  toPublic,
};
