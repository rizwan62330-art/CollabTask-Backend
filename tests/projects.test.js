const { app, request, registerUser, createProject, createTask, addMember } = require("./helpers");

describe("projects CRUD", () => {
  it("creates a project and makes the creator its owner", async () => {
    const owner = await registerUser();
    const res = await owner.auth(request(app).post("/api/v1/projects")).send({ name: "Alpha", description: "First", color: "#2f9e68" });
    expect(res.status).toBe(201);
    expect(res.body.project).toMatchObject({ name: "Alpha", color: "#2f9e68", ownerId: owner.user.id });

    const detail = await owner.auth(request(app).get(`/api/v1/projects/${res.body.project.id}`));
    expect(detail.body.project.members).toEqual([expect.objectContaining({ id: owner.user.id, role: "owner" })]);
  });

  it("validates input", async () => {
    const owner = await registerUser();
    const noName = await owner.auth(request(app).post("/api/v1/projects")).send({ name: "  " });
    expect(noName.status).toBe(400);
    const badColor = await owner.auth(request(app).post("/api/v1/projects")).send({ name: "X", color: "red" });
    expect(badColor.status).toBe(400);
  });

  it("lists only projects the user belongs to, with task counts", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const pa = await createProject(a, { name: "A's" });
    await createProject(b, { name: "B's" });
    const t1 = await createTask(a, pa.id);
    await createTask(a, pa.id);
    await a.auth(request(app).patch(`/api/v1/tasks/${t1.id}`)).send({ columnId: "done" });

    const res = await a.auth(request(app).get("/api/v1/projects"));
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0]).toMatchObject({ name: "A's", total: 2, done: 1 });
  });

  it("updates and deletes (owner only)", async () => {
    const owner = await registerUser();
    const p = await createProject(owner);
    const upd = await owner.auth(request(app).patch(`/api/v1/projects/${p.id}`)).send({ name: "Renamed" });
    expect(upd.status).toBe(200);
    expect(upd.body.project.name).toBe("Renamed");

    const del = await owner.auth(request(app).delete(`/api/v1/projects/${p.id}`));
    expect(del.status).toBe(204);
    const after = await owner.auth(request(app).get(`/api/v1/projects/${p.id}`));
    expect(after.status).toBe(404);
  });

  it("returns 404 for an unknown project and 400 for a malformed id", async () => {
    const u = await registerUser();
    const missing = await u.auth(request(app).get("/api/v1/projects/00000000-0000-4000-8000-000000000000"));
    expect(missing.status).toBe(404);
    const malformed = await u.auth(request(app).get("/api/v1/projects/not-a-uuid"));
    expect(malformed.status).toBe(400);
  });
});

describe("project authorization", () => {
  it("blocks non-members with 403", async () => {
    const owner = await registerUser();
    const stranger = await registerUser();
    const p = await createProject(owner);
    expect((await stranger.auth(request(app).get(`/api/v1/projects/${p.id}`))).status).toBe(403);
    expect((await stranger.auth(request(app).get(`/api/v1/projects/${p.id}/tasks`))).status).toBe(403);
  });

  it("lets members read but not edit/delete the project", async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const p = await createProject(owner);
    await addMember(owner, p.id, member.user.id);

    expect((await member.auth(request(app).get(`/api/v1/projects/${p.id}`))).status).toBe(200);
    expect((await member.auth(request(app).patch(`/api/v1/projects/${p.id}`)).send({ name: "Hax" })).status).toBe(403);
    expect((await member.auth(request(app).delete(`/api/v1/projects/${p.id}`))).status).toBe(403);
  });

  it("lets an admin edit but not delete", async () => {
    const owner = await registerUser();
    const admin = await registerUser();
    const p = await createProject(owner);
    await addMember(owner, p.id, admin.user.id, "admin");
    expect((await admin.auth(request(app).patch(`/api/v1/projects/${p.id}`)).send({ name: "By admin" })).status).toBe(200);
    expect((await admin.auth(request(app).delete(`/api/v1/projects/${p.id}`))).status).toBe(403);
  });
});

describe("membership management", () => {
  it("adds and removes members; rejects duplicates and unknown users", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const p = await createProject(owner);

    const add = await addMember(owner, p.id, other.user.id);
    expect(add.status).toBe(201);
    expect(add.body.members).toHaveLength(2);

    expect((await addMember(owner, p.id, other.user.id)).status).toBe(409);
    expect((await addMember(owner, p.id, "00000000-0000-4000-8000-000000000000")).status).toBe(404);

    const rm = await owner.auth(request(app).delete(`/api/v1/projects/${p.id}/members/${other.user.id}`));
    expect(rm.status).toBe(200);
    expect(rm.body.members).toHaveLength(1);
  });

  it("refuses to remove the last owner", async () => {
    const owner = await registerUser();
    const p = await createProject(owner);
    const res = await owner.auth(request(app).delete(`/api/v1/projects/${p.id}/members/${owner.user.id}`));
    expect(res.status).toBe(409);
  });

  it("does not let a plain member add members", async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const third = await registerUser();
    const p = await createProject(owner);
    await addMember(owner, p.id, member.user.id);
    expect((await addMember(member, p.id, third.user.id)).status).toBe(403);
  });
});
