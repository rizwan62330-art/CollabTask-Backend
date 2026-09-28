const AppError = require("../../utils/AppError");
const projectsRepo = require("./projects.repository");

/** Throws 404/403 and returns the membership row if the user may access the project at all. */
function assertMember(projectId, userId) {
  const project = projectsRepo.findById(projectId);
  if (!project) throw AppError.notFound("Project not found.");

  const membership = projectsRepo.getMembership(projectId, userId);
  if (!membership) throw AppError.forbidden("You are not a member of this project.");

  return { project, membership };
}

/** Throws 403 unless the membership's role is one of `roles`. */
function assertRole(membership, roles) {
  if (!roles.includes(membership.role)) {
    throw AppError.forbidden(`This action requires one of these roles: ${roles.join(", ")}.`);
  }
}

/** Express middleware for routes shaped /projects/:projectId[...]. Attaches req.project and req.membership. */
function requireProjectMember(req, res, next) {
  try {
    const { project, membership } = assertMember(req.params.projectId, req.user.id);
    req.project = project;
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

function requireProjectRole(...roles) {
  return (req, res, next) => {
    try {
      assertRole(req.membership, roles);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { assertMember, assertRole, requireProjectMember, requireProjectRole };
