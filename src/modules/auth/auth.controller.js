const bcrypt = require("bcryptjs");
const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/AppError");
const { newId } = require("../../utils/id");
const { signAccessToken } = require("../../utils/tokens");
const usersRepo = require("../users/users.repository");

const SALT_ROUNDS = 10;

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (usersRepo.findByEmailRaw(email)) {
    throw AppError.conflict("An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = usersRepo.create({ id: newId(), name, email, passwordHash });
  const token = signAccessToken(user);

  res.status(201).json({ user, token });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const row = usersRepo.findByEmailRaw(email);
  if (!row) {
    // Same message as a wrong password — never reveal which part was wrong.
    throw AppError.unauthorized("Incorrect email or password.");
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw AppError.unauthorized("Incorrect email or password.");
  }

  const user = usersRepo.toPublic(row);
  const token = signAccessToken(user);
  res.json({ user, token });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { register, login, me };
