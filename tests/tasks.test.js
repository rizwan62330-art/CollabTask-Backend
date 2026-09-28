const { app, request, registerUser, createProject, createTask, addMember } = require("./helpers");

async function setup() {
  const owner = await registerUser();
  const member = await registerUser();
  const stranger = await registerUser();
  const project = await createProject(owner);
  await addMember(owner, project.id, member.user.id);
  return { owner, member, stranger, project };
}

const listTasks = (u, projectId) => u.auth(request(app).get(`/api/v1/projects/${projectId}/tasks`));

describe("tasks CRUD", () => {
  it("creates a task with defaults and appends positions per column", async () => {
    const { owner, project } = await setup();
    const t1 = await createTask(owner, project.id, { title: "One" });
    const t2 = await createTask(owner, project.id, { title: "Two" });
    expect(t1).toMatchObject({ columnId: "todo", priority: "medium", assigneeId: null, position: 0 });
    expect(t2.position).toBe(1);
  });

  it("validates task input", async () => {
    const { owner, project } = await setup();
    const url = `/api/v1/projects/${project.id}/tasks`;
    expect((await owner.auth(request(app).post(url)).send({ title: "" })).status).toBe(400);
    expect((await owner.auth(request(app).post(url)).send({ title: "x", columnId: "nope" })).status).toBe(400);
    expect((await owner.auth(request(app).post(url)).send({ title: "x", priority: "urgent" })).status).toBe(400);
    expect((await owner.auth(request(app).post(url)).send({ title: "x", dueDate: "not-a-date" })).status).toBe(400);
  });

  it("gets, partially updates, and deletes a task", async () => {
    const { owner, project } = await setup();
    const t = await createTask(owner, project.id, { title: "Draft" });

    const got = await owner.auth(request(app).get(`/api/v1/tasks/${t.id}`));
    expect(got.body.task.title).toBe("Draft");

    const upd = await owner.auth(request(app).patch(`/api/v1/tasks/${t.id}`)).send({ priority: "high", dueDate: "2026-12-01" });
    expect(upd.body.task).toMatchObject({ title: "Draft", priority: "high", dueDate: "2026-12-01" });

    const empty = await owner.auth(request(app).patch(`/api/v1/tasks/${t.id}`)).send({});
    expect(empty.status).toBe(400);

    expect((await owner.auth(request(app).delete(`/api/v1/tasks/${t.id}`))).status).toBe(204);
    expect((await owner.auth(request(app).get(`/api/v1/tasks/${t.id}`))).status).toBe(404);
  });

  it("can clear the assignee and due date with null", async () => {
    const { owner, member, project } = await setup();
    const t = await createTask(owner, project.id, { assigneeId: member.user.id, dueDate: "2026-11-01" });
    const upd = await owner.auth(request(app).patch(`/api/v1/tasks/${t.id}`)).send({ assigneeId: null, dueDate: null });
    expect(upd.body.task.assigneeId).toBeNull();
    expect(upd.body.task.dueDate).toBeNull();
  });
});

describe("task authorization", () => {
  it("hides tasks from non-members", async () => {
    const { owner, stranger, project } = await setup();
    const t = await createTask(owner, project.id);
    expect((await stranger.auth(request(app).get(`/api/v1/tasks/${t.id}`))).status).toBe(403);
    expect((await stranger.auth(request(app).patch(`/api/v1/tasks/${t.id}`)).send({ title: "x" })).status).toBe(403);
    expect((await stranger.auth(request(app).post(`/api/v1/projects/${project.id}/tasks`)).send({ title: "x" })).status).toBe(403);
  });

  it("only lets owner/admin or the assignee delete a task", async () => {
    const { owner, member, project } = await setup();
    const unassigned = await createTask(owner, project.id);
    expect((await member.auth(request(app).delete(`/api/v1/tasks/${unassigned.id}`))).status).toBe(403);

    const mine = await createTask(owner, project.id, { assigneeId: member.user.id });
    expect((await member.auth(request(app).delete(`/api/v1/tasks/${mine.id}`))).status).toBe(204);
  });
});

describe("moving tasks", () => {
  it("changing columnId via PATCH appends the task to the end of the new column", async () => {
    const { owner, project } = await setup();
    await createTask(owner, project.id, { title: "D1", columnId: "done" });
    const t = await createTask(owner, project.id, { title: "Mover" });
    const res = await owner.auth(request(app).patch(`/api/v1/tasks/${t.id}`)).send({ columnId: "done" });
    expect(res.body.task).toMatchObject({ columnId: "done", position: 1 });
  });

  it("PATCH /move inserts at an exact position and keeps both columns contiguous", async () => {
    const { owner, project } = await setup();
    const a = await createTask(owner, project.id, { title: "A", columnId: "todo" });
    const b = await createTask(owner, project.id, { title: "B", columnId: "todo" });
    const c = await createTask(owner, project.id, { title: "C", columnId: "todo" });
    const x = await createTask(owner, project.id, { title: "X", columnId: "review" });
    const y = await createTask(owner, project.id, { title: "Y", columnId: "review" });

    // Move A (todo #0) into review at index 1 -> review order: X, A, Y ; todo: B, C
    const res = await owner.auth(request(app).patch(`/api/v1/tasks/${a.id}/move`)).send({ columnId: "review", position: 1 });
    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({ columnId: "review", position: 1 });

    const all = (await listTasks(owner, project.id)).body.tasks;
    const order = (col) => all.filter((t) => t.columnId === col).sort((p, q) => p.position - q.position).map((t) => t.title);
    expect(order("review")).toEqual(["X", "A", "Y"]);
    expect(order("todo")).toEqual(["B", "C"]);
    expect(all.filter((t) => t.columnId === "todo").map((t) => t.position).sort()).toEqual([0, 1]);
    void b; void c; void x; void y;
  });

  it("reorders within the same column and clamps out-of-range positions", async () => {
    const { owner, project } = await setup();
    const a = await createTask(owner, project.id, { title: "A" });
    await createTask(owner, project.id, { title: "B" });
    await createTask(owner, project.id, { title: "C" });

    await owner.auth(request(app).patch(`/api/v1/tasks/${a.id}/move`)).send({ columnId: "todo", position: 99 });
    const titles = (await listTasks(owner, project.id)).body.tasks.map((t) => t.title);
    expect(titles).toEqual(["B", "C", "A"]);
  });

  it("validates the move body", async () => {
    const { owner, project } = await setup();
    const t = await createTask(owner, project.id);
    expect((await owner.auth(request(app).patch(`/api/v1/tasks/${t.id}/move`)).send({ columnId: "todo", position: -1 })).status).toBe(400);
    expect((await owner.auth(request(app).patch(`/api/v1/tasks/${t.id}/move`)).send({ columnId: "bogus", position: 0 })).status).toBe(400);
  });
});

describe("comments", () => {
  it("adds, lists, and deletes comments with proper permissions", async () => {
    const { owner, member, stranger, project } = await setup();
    const t = await createTask(owner, project.id);

    const add = await member.auth(request(app).post(`/api/v1/tasks/${t.id}/comments`)).send({ body: "  Nice work  " });
    expect(add.status).toBe(201);
    expect(add.body.comment).toMatchObject({ body: "Nice work", authorId: member.user.id });

    const list = await owner.auth(request(app).get(`/api/v1/tasks/${t.id}/comments`));
    expect(list.body.comments).toHaveLength(1);

    expect((await stranger.auth(request(app).get(`/api/v1/tasks/${t.id}/comments`))).status).toBe(403);
    expect((await member.auth(request(app).post(`/api/v1/tasks/${t.id}/comments`)).send({ body: "   " })).status).toBe(400);

    // a different plain member cannot delete someone else's comment, but the owner can
    const other = await registerUser();
    await addMember(owner, project.id, other.user.id);
    const id = add.body.comment.id;
    expect((await other.auth(request(app).delete(`/api/v1/comments/${id}`))).status).toBe(403);
    expect((await owner.auth(request(app).delete(`/api/v1/comments/${id}`))).status).toBe(204);
  });
});

describe("notifications", () => {
  it("notifies an assignee when assigned on create and on reassignment, but not for self-assignment", async () => {
    const { owner, member, project } = await setup();
    await createTask(owner, project.id, { title: "Assigned at creation", assigneeId: member.user.id });
    const later = await createTask(owner, project.id, { title: "Assigned later" });
    await owner.auth(request(app).patch(`/api/v1/tasks/${later.id}`)).send({ assigneeId: member.user.id });
    await createTask(owner, project.id, { title: "Self", assigneeId: owner.user.id });

    const mine = await member.auth(request(app).get("/api/v1/notifications"));
    expect(mine.body.notifications).toHaveLength(2);
    expect(mine.body.notifications[0]).toMatchObject({ type: "task_assigned", readAt: null });
    expect(mine.body.notifications[0].payload).toHaveProperty("taskTitle");

    const ownersList = await owner.auth(request(app).get("/api/v1/notifications"));
    expect(ownersList.body.notifications).toHaveLength(0);
  });

  it("notifies the assignee when someone else comments", async () => {
    const { owner, member, project } = await setup();
    const t = await createTask(owner, project.id, { assigneeId: member.user.id });
    await owner.auth(request(app).post(`/api/v1/tasks/${t.id}/comments`)).send({ body: "ping" });
    const res = await member.auth(request(app).get("/api/v1/notifications"));
    expect(res.body.notifications.map((n) => n.type)).toContain("comment_added");
  });

  it("marks one or all notifications as read, and only your own", async () => {
    const { owner, member, project } = await setup();
    await createTask(owner, project.id, { assigneeId: member.user.id });
    await createTask(owner, project.id, { assigneeId: member.user.id });
    const list = (await member.auth(request(app).get("/api/v1/notifications"))).body.notifications;

    const one = await member.auth(request(app).patch(`/api/v1/notifications/${list[0].id}/read`));
    expect(one.status).toBe(200);
    expect(one.body.notification.readAt).not.toBeNull();

    // someone else can't mark it
    expect((await owner.auth(request(app).patch(`/api/v1/notifications/${list[1].id}/read`))).status).toBe(404);

    const all = await member.auth(request(app).patch("/api/v1/notifications/read-all"));
    expect(all.body.updated).toBe(1);
  });
});

describe("cascades", () => {
  it("deleting a project removes its tasks and comments", async () => {
    const { owner, project } = await setup();
    const t = await createTask(owner, project.id);
    await owner.auth(request(app).post(`/api/v1/tasks/${t.id}/comments`)).send({ body: "x" });
    await owner.auth(request(app).delete(`/api/v1/projects/${project.id}`));
    expect((await owner.auth(request(app).get(`/api/v1/tasks/${t.id}`))).status).toBe(404);
  });
});
