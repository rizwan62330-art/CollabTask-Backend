// Runs before each test file: use an in-memory database and a fixed JWT secret
// so tests never touch the real database file.
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
