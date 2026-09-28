const { Router } = require("express");
const requireAuth = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { requireProjectMember } = require("../projects/projects.access");
const { projectIdParam, taskIdParam, createTaskSchema, updateTaskSchema, moveTaskSchema } = require("./tasks.schemas");
const controller = require("./tasks.controller");

// Mounted at /api/v1/projects/:projectId/tasks — mergeParams so req.params.projectId is visible here.
const projectTasksRouter = Router({ mergeParams: true });
projectTasksRouter.use(requireAuth, validate({ params: projectIdParam }), requireProjectMember);
projectTasksRouter.get("/", controller.listForProject);
projectTasksRouter.post("/", validate({ body: createTaskSchema }), controller.create);

// Mounted at /api/v1/tasks — project access is resolved from the task itself inside the controller.
const taskRouter = Router();
taskRouter.use(requireAuth);
taskRouter.get("/:taskId", validate({ params: taskIdParam }), controller.getOne);
taskRouter.patch("/:taskId", validate({ params: taskIdParam, body: updateTaskSchema }), controller.update);
taskRouter.patch("/:taskId/move", validate({ params: taskIdParam, body: moveTaskSchema }), controller.move);
taskRouter.delete("/:taskId", validate({ params: taskIdParam }), controller.remove);

module.exports = { projectTasksRouter, taskRouter };
