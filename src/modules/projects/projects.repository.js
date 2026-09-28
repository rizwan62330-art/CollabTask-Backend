const db = require("../../db");
const { toPublic: userToPublic } = require("../users/users.repository");

function projectToPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    ...(row.total !== undefined ? { total: row.total, done: row.done } : {}),
  };
}

const insertProjectStmt = db.prepare(
  `INSERT INTO projects (id, name, description, color, owner_id) VALUES (@id, @name, @description, @color, @ownerId)`
);
const findByIdStmt = db.prepare(`SELECT * FROM projects WHERE id = ?`);
const listForUserStmt = db.prepare(`
  SELECT p.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.column_id = 'done') AS done
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.id
  WHERE pm.user_id = ?
  ORDER BY p.created_at DESC
`);
const updateStmt = db.prepare(`
  UPDATE projects SET name = @name, description = @description, color = @color WHERE id = @id
`);
const deleteStmt = db.prepare(`DELETE FROM projects WHERE id = ?`);

const insertMemberStmt = db.prepare(
  `INSERT INTO project_members (id, project_id, user_id, role) VALUES (@id, @projectId, @userId, @role)`
);
const getMembershipStmt = db.prepare(`SELECT * FROM project_members WHERE project_id = ? AND user_id = ?`);
const listMembersStmt = db.prepare(`
  SELECT u.*, pm.role AS member_role FROM project_members pm
  JOIN users u ON u.id = pm.user_id
  WHERE pm.project_id = ?
  ORDER BY pm.created_at ASC
`);
const removeMemberStmt = db.prepare(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`);
const countOwnersStmt = db.prepare(`SELECT COUNT(*) AS n FROM project_members WHERE project_id = ? AND role = 'owner'`);

module.exports = {
  create({ id, name, description, color, ownerId }) {
    const insertBoth = db.transaction(() => {
      insertProjectStmt.run({ id, name, description, color, ownerId });
      insertMemberStmt.run({ id: `${id}-owner`, projectId: id, userId: ownerId, role: "owner" });
    });
    insertBoth();
    return this.findById(id);
  },

  findById(id) {
    return projectToPublic(findByIdStmt.get(id));
  },

  listForUser(userId) {
    return listForUserStmt.all(userId).map(projectToPublic);
  },

  update(id, { name, description, color }) {
    const current = findByIdStmt.get(id);
    if (!current) return null;
    updateStmt.run({
      id,
      name: name ?? current.name,
      description: description ?? current.description,
      color: color ?? current.color,
    });
    return this.findById(id);
  },

  delete(id) {
    deleteStmt.run(id);
  },

  addMember({ id, projectId, userId, role = "member" }) {
    insertMemberStmt.run({ id, projectId, userId, role });
  },

  getMembership(projectId, userId) {
    return getMembershipStmt.get(projectId, userId) || null;
  },

  listMembers(projectId) {
    return listMembersStmt.all(projectId).map((row) => ({
      ...userToPublic(row),
      role: row.member_role,
    }));
  },

  /** Returns false (rather than throwing) if this would remove the project's last owner. */
  removeMember(projectId, userId) {
    const membership = getMembershipStmt.get(projectId, userId);
    if (membership?.role === "owner") {
      const { n } = countOwnersStmt.get(projectId);
      if (n <= 1) return false;
    }
    removeMemberStmt.run(projectId, userId);
    return true;
  },

  projectToPublic,
};
