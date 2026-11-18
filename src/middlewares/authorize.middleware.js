import { UnauthorizedError, ForbiddenError } from "../errors/index.js";

export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!allowedRoles.includes(req.user.role)) return next(new ForbiddenError());

    next();
  };
};
