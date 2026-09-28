const { app, request, registerUser } = require("./helpers");

describe("POST /auth/register", () => {
  it("creates an account and returns a token, never the password hash", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({ name: "Ada", email: "Ada@Example.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("ada@example.com"); // normalised to lowercase
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/v1/auth/register").send({ name: "A", email: "dup@example.com", password: "password123" });
    const res = await request(app).post("/api/v1/auth/register").send({ name: "B", email: "dup@example.com", password: "password123" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("returns field-level validation errors with 400", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({ name: "", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app).post("/api/v1/auth/register").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials", async () => {
    const u = await registerUser({ email: "login@example.com" });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "login@example.com", password: u.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    await registerUser({ email: "known@example.com" });
    const wrongPw = await request(app).post("/api/v1/auth/login").send({ email: "known@example.com", password: "wrongpass1" });
    const unknown = await request(app).post("/api/v1/auth/login").send({ email: "ghost@example.com", password: "wrongpass1" });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(unknown.body.error.message);
  });
});

describe("GET /auth/me and token handling", () => {
  it("returns the current user for a valid token", async () => {
    const u = await registerUser();
    const res = await u.auth(request(app).get("/api/v1/auth/me"));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(u.user.id);
  });

  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a tampered token", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer abc.def.ghi");
    expect(res.status).toBe(401);
  });

  it("rejects an expired token with a helpful message", async () => {
    const jwt = require("jsonwebtoken");
    const u = await registerUser();
    const expired = jwt.sign({ sub: u.user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });
});

describe("misc", () => {
  it("health check is public", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("unknown routes return a JSON 404", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
