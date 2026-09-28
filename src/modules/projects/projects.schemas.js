const { z } = require("zod");

const idParam = z.object({ projectId: z.string().uuid("Invalid project id.") });

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #3968d8.");

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(150),
  description: z.string().trim().max(2000).optional().default(""),
  color: hexColor.optional().default("#3968d8"),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  color: hexColor.optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid("Invalid user id."),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

const memberParams = z.object({
  projectId: z.string().uuid("Invalid project id."),
  userId: z.string().uuid("Invalid user id."),
});

module.exports = { idParam, createProjectSchema, updateProjectSchema, addMemberSchema, memberParams };
