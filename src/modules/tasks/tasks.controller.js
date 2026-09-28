const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/AppError");
const { newId } = require("../../utils/id");
const tasksRepo = require("./tasks.repository");
const projectsRepo = require("../projects/projects.repository");
const notificationsRepo = require("../notifications/notifications.repository");
const { assertMember } = require("../projects/projects.access");

/** Loads a task and checks the requester is a member of its project. Used by every /tasks/:taskId route. */
function loadTaskAndAssertAccess(taskId, userId) {
  const task = tasksRepo.findById(taskId);
  if (!task) throw AppError.notFound("Task not found.");
  const { project, membership } = assertMember(task.projectId, userId);
  return { task, project, membership };
}

function notifyAssignment(task, assigneeId, actingUser) {
  if (!assigneeId || assigneeId === actingUser.id) return; // don't notify yourself
  notificationsRepo.create({
    id: newId(),
    userId: assigneeId,
    type: "task_assigned",
    payload: { taskId: task.id, taskTitle: task.title, projectId: task.projectId, byUserName: actingUser.name },
  });
}

const listForProject = asyncHandler(async (req, res) => {
  res.json({ tasks: tasksRepo.listByProject(req.project.id) });
});

const create = asyncHandler(async (req, res) => {
  const task = tasksRepo.create({ id: newId(), projectId: req.project.id, ...req.body });
  notifyAssignment(task, task.assigneeId, req.user);
  res.status(201).json({ task });
});

const getOne = asyncHandler(async (req, res) => {
  const { task } = loadTaskAndAssertAccess(req.params.taskId, req.user.id);
  res.json({ task });
});

const update = asyncHandler(async (req, res) => {
  const { task: before } = loadTaskAndAssertAccess(req.params.taskId, req.user.id);
  const task = tasksRepo.update(before.id, req.body);

  if (req.body.assigneeId !== undefined && req.body.assigneeId !== before.assigneeId) {
    notifyAssignment(task, task.assigneeId, req.user);
  }
  res.json({ task });
});

const move = asyncHandler(async (req, res) => {
  const { task: before } = loadTaskAndAssertAccess(req.params.taskId, req.user.id);
  const task = tasksRepo.move(before.id, req.body.columnId, req.body.position);
  res.json({ task });
});

const remove = asyncHandler(async (req, res) => {
  const { task, membership } = loadTaskAndAssertAccess(req.params.taskId, req.user.id);
  const canDelete = membership.role === "owner" || membership.role === "admin" || task.assigneeId === req.user.id;
  if (!canDelete) {
    throw AppError.forbidden("Only the project owner/admin or the assignee can delete this task.");
  }
  tasksRepo.delete(task.id);
  res.status(204).send();
});

module.exports = { listForProject, create, getOne, update, move, remove, loadTaskAndAssertAccess };
