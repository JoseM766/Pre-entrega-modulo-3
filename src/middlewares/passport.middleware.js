import passport from "passport";
import { InvalidCredentialsError } from "../errors/index.js";

// Ejecuta una estrategia de passport (register / login).
// Los errores de negocio de register llegan como AppError por "err" y van al middleware global.
// Si la estrategia no devuelve usuario (por ej. faltan email/password, que passport-local detecta
// antes de llamar a nuestro código), se lanza FailError. En el login es siempre el mismo error genérico.
export const authenticateStrategy = (strategyName, FailError = InvalidCredentialsError) => {
  return (req, res, next) => {
    passport.authenticate(strategyName, { session: false }, (err, user) => {
      if (err) return next(err);
      if (!user) return next(new FailError());

      req.user = user;
      next();
    })(req, res, next);
  };
};
