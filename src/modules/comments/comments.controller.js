const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/AppError");
const { newId } = require("../../utils/id");
const commentsRepo = require("./comments.repository");
const notificationsRepo = require("../notifications/notifications.repository");
const { loadTaskAndAssertAccess } = require("../tasks/tasks.controller");

const list = asyncHandler(async (req, res) => {
  const { task } = loadTaskAndAssertAccess(req.params.taskId, req.user.id);
  res.json({ comments: commentsRepo.listByTask(task.id) });
});

const create = asyncHandler(async (req, res) => {
  const { task } = loadTaskAndAssertAccess(req.params.taskId, req.user.id);
  const comment = commentsRepo.create({ id: newId(), taskId: task.id, authorId: req.user.id, body: req.body.body });

  if (task.assigneeId && task.assigneeId !== req.user.id) {
    notificationsRepo.create({
      id: newId(),
      userId: task.assigneeId,
      type: "comment_added",
      payload: { taskId: task.id, taskTitle: task.title, projectId: task.projectId, byUserName: req.user.name },
    });
  }

  res.status(201).json({ comment });
});

const remove = asyncHandler(async (req, res) => {
  const comment = commentsRepo.findById(req.params.commentId);
  if (!comment) throw AppError.notFound("Comment not found.");

  const { membership } = loadTaskAndAssertAccess(comment.taskId, req.user.id);
  const canDelete = comment.authorId === req.user.id || membership.role === "owner" || membership.role === "admin";
  if (!canDelete) throw AppError.forbidden("Only the comment's author or a project owner/admin can delete it.");

  commentsRepo.delete(comment.id);
  res.status(204).send();
});

module.exports = { list, create, remove };
