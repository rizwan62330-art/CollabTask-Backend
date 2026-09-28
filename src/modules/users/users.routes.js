const { Router } = require("express");
const requireAuth = require("../../middleware/auth");
const asyncHandler = require("../../utils/asyncHandler");
const usersRepo = require("./users.repository");

const router = Router();

/** Any authenticated user can list the user directory — needed to populate assignee pickers. */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ users: usersRepo.listAll() });
  })
);

module.exports = router;
