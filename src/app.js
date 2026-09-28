const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const requireAuth = require("./middleware/auth");
const notFoundHandler = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { requireProjectMember } = require("./modules/projects/projects.access");

const authRoutes = require("./modules/auth/auth.routes");
const usersRoutes = require("./modules/users/users.routes");
const projectsRoutes = require("./modules/projects/projects.routes");
const { projectTasksRouter, taskRouter } = require("./modules/tasks/tasks.routes");
const { taskCommentsRouter, commentRouter } = require("./modules/comments/comments.routes");
const notificationsRoutes = require("./modules/notifications/notifications.routes");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(express.json({ limit: "1mb" }));

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
  }

  app.get("/api/v1/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Interactive API docs (Swagger UI), served from the hand-written openapi.yaml.
  try {
    const swaggerUi = require("swagger-ui-express");
    const YAML = require("yamljs");
    const openapiDocument = YAML.load(path.join(__dirname, "..", "openapi.yaml"));
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));
  } catch (err) {
    console.warn("Swagger UI not mounted:", err.message);
  }

  const v1 = express.Router();
  v1.use("/auth", authRoutes);
  v1.use("/users", usersRoutes);
  v1.use("/projects", projectsRoutes);
  // Nested, project-scoped task routes: /projects/:projectId/tasks
  v1.use("/projects/:projectId/tasks", requireAuth, projectTasksRouter);
  // Task-by-id routes: /tasks/:taskId[...]
  v1.use("/tasks", taskRouter);
  v1.use("/tasks/:taskId/comments", requireAuth, taskCommentsRouter);
  v1.use("/comments", commentRouter);
  v1.use("/notifications", notificationsRoutes);

  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
