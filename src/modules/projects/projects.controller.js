const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/AppError");
const { newId } = require("../../utils/id");
const projectsRepo = require("./projects.repository");
const usersRepo = require("../users/users.repository");
const { assertRole } = require("./projects.access");

const list = asyncHandler(async (req, res) => {
  res.json({ projects: projectsRepo.listForUser(req.user.id) });
});

const create = asyncHandler(async (req, res) => {
  const { name, description, color } = req.body;
  const project = projectsRepo.create({ id: newId(), name, description, color, ownerId: req.user.id });
  res.status(201).json({ project });
});

/** req.project / req.membership are already attached by the requireProjectMember middleware. */
const getOne = asyncHandler(async (req, res) => {
  const members = projectsRepo.listMembers(req.project.id);
  res.json({ project: { ...req.project, members } });
});

const update = asyncHandler(async (req, res) => {
  assertRole(req.membership, ["owner", "admin"]);
  const project = projectsRepo.update(req.project.id, req.body);
  res.json({ project });
});

const remove = asyncHandler(async (req, res) => {
  assertRole(req.membership, ["owner"]);
  projectsRepo.delete(req.project.id);
  res.status(204).send();
});

const addMember = asyncHandler(async (req, res) => {
  assertRole(req.membership, ["owner", "admin"]);
  const { userId, role } = req.body;

  const user = usersRepo.findById(userId);
  if (!user) throw AppError.notFound("No user with that id.");

  if (projectsRepo.getMembership(req.project.id, userId)) {
    throw AppError.conflict("That user is already a member of this project.");
  }

  projectsRepo.addMember({ id: newId(), projectId: req.project.id, userId, role });
  res.status(201).json({ members: projectsRepo.listMembers(req.project.id) });
});

const removeMember = asyncHandler(async (req, res) => {
  assertRole(req.membership, ["owner", "admin"]);
  const removed = projectsRepo.removeMember(req.project.id, req.params.userId);
  if (!removed) {
    throw AppError.conflict("A project must keep at least one owner.");
  }
  res.json({ members: projectsRepo.listMembers(req.project.id) });
});

module.exports = { list, create, getOne, update, remove, addMember, removeMember };
