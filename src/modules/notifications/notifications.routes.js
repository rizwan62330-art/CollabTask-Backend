const { Router } = require("express");
const requireAuth = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/AppError");
const repo = require("./notifications.repository");

const idParam = z.object({ notificationId: z.string().uuid("Invalid notification id.") });

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ notifications: repo.listForUser(req.user.id) });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    const updated = repo.markAllRead(req.user.id);
    res.json({ updated });
  })
);

router.patch(
  "/:notificationId/read",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const ok = repo.markRead(req.params.notificationId, req.user.id);
    if (!ok) throw AppError.notFound("Notification not found.");
    res.json({ notification: repo.findById(req.params.notificationId) });
  })
);

module.exports = router;
