const { Router } = require("express");
const validate = require("../../middleware/validate");
const requireAuth = require("../../middleware/auth");
const { authLimiter } = require("../../middleware/rateLimiter");
const { registerSchema, loginSchema } = require("./auth.schemas");
const controller = require("./auth.controller");

const router = Router();

router.post("/register", authLimiter, validate({ body: registerSchema }), controller.register);
router.post("/login", authLimiter, validate({ body: loginSchema }), controller.login);
router.get("/me", requireAuth, controller.me);

module.exports = router;
