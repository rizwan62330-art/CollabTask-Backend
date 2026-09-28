const { z } = require("zod");

const COLUMN_IDS = ["todo", "in_progress", "review", "done"];
const PRIORITIES = ["low", "medium", "high"];

const projectIdParam = z.object({ projectId: z.string().uuid("Invalid project id.") });
const taskIdParam = z.object({ taskId: z.string().uuid("Invalid task id.") });

// Accepts "YYYY-MM-DD" or a full ISO timestamp; stored as given.
const dueDateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "dueDate must be a valid date.")
  .nullable();

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required.").max(200),
  description: z.string().trim().max(5000).optional().default(""),
  columnId: z.enum(COLUMN_IDS).optional().default("todo"),
  priority: z.enum(PRIORITIES).optional().default("medium"),
  assigneeId: z.string().uuid().nullable().optional().default(null),
  dueDate: dueDateSchema.optional().default(null),
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    columnId: z.enum(COLUMN_IDS).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: dueDateSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update.");

const moveTaskSchema = z.object({
  columnId: z.enum(COLUMN_IDS),
  position: z.number().int().min(0),
});

module.exports = { COLUMN_IDS, PRIORITIES, projectIdParam, taskIdParam, createTaskSchema, updateTaskSchema, moveTaskSchema };
