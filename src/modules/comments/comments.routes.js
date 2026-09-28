const { Router } = require("express");
const requireAuth = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { taskIdParam, commentIdParam, createCommentSchema } = require("./comments.schemas");
const controller = require("./comments.controller");

// Mounted at /api/v1/tasks/:taskId/comments
const taskCommentsRouter = Router({ mergeParams: true });
taskCommentsRouter.use(requireAuth);
taskCommentsRouter.get("/", validate({ params: taskIdParam }), controller.list);
taskCommentsRouter.post("/", validate({ params: taskIdParam, body: createCommentSchema }), controller.create);

// Mounted at /api/v1/comments
const commentRouter = Router();
commentRouter.use(requireAuth);
commentRouter.delete("/:commentId", validate({ params: commentIdParam }), controller.remove);

module.exports = { taskCommentsRouter, commentRouter };
