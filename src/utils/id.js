const { randomUUID } = require("crypto");

/** Generates a v4 UUID using Node's built-in crypto module (no extra dependency). */
module.exports = { newId: () => randomUUID() };
