import passport from "passport";
import { UnauthorizedError } from "../errors/index.js";

export const authenticate = (req, res, next) => {
  passport.authenticate("current", { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) return next(new UnauthorizedError());

    req.user = user;
    next();
  })(req, res, next);
};
