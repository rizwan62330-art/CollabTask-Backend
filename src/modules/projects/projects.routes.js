const { Router } = require("express");
const requireAuth = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { requireProjectMember } = require("./projects.access");
const { idParam, createProjectSchema, updateProjectSchema, addMemberSchema, memberParams } = require("./projects.schemas");
const controller = require("./projects.controller");

const router = Router();

router.use(requireAuth);

router.get("/", controller.list);
router.post("/", validate({ body: createProjectSchema }), controller.create);

router.get("/:projectId", validate({ params: idParam }), requireProjectMember, controller.getOne);
router.patch("/:projectId", validate({ params: idParam, body: updateProjectSchema }), requireProjectMember, controller.update);
router.delete("/:projectId", validate({ params: idParam }), requireProjectMember, controller.remove);

router.post(
  "/:projectId/members",
  validate({ params: idParam, body: addMemberSchema }),
  requireProjectMember,
  controller.addMember
);
router.delete(
  "/:projectId/members/:userId",
  validate({ params: memberParams }),
  requireProjectMember,
  controller.removeMember
);

module.exports = router;
