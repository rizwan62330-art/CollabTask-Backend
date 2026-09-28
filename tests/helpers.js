const request = require("supertest");
const createApp = require("../src/app");

const app = createApp();
let counter = 0;

/** Registers a fresh user and returns { user, token, password, auth } where auth(req) adds the Bearer header. */
async function registerUser(overrides = {}) {
  counter += 1;
  const body = {
    name: overrides.name || `Test User ${counter}`,
    email: overrides.email || `user${counter}-${Date.now()}@example.com`,
    password: overrides.password || "password123",
  };
  const res = await request(app).post("/api/v1/auth/register").send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, password: body.password, auth: (r) => r.set("Authorization", `Bearer ${res.body.token}`) };
}

async function createProject(owner, body = {}) {
  const res = await owner.auth(request(app).post("/api/v1/projects")).send({ name: "Test Project", ...body });
  return res.body.project;
}

async function createTask(user, projectId, body = {}) {
  const res = await user.auth(request(app).post(`/api/v1/projects/${projectId}/tasks`)).send({ title: "A task", ...body });
  return res.body.task;
}

async function addMember(owner, projectId, userId, role = "member") {
  return owner.auth(request(app).post(`/api/v1/projects/${projectId}/members`)).send({ userId, role });
}

module.exports = { app, request, registerUser, createProject, createTask, addMember };
