const { z } = require("zod");

const taskIdParam = z.object({ taskId: z.string().uuid("Invalid task id.") });
const commentIdParam = z.object({ commentId: z.string().uuid("Invalid comment id.") });

const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty.").max(3000),
});

module.exports = { taskIdParam, commentIdParam, createCommentSchema };
