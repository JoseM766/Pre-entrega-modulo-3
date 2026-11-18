import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy } from "passport-jwt";
import * as sessionsService from "../services/sessions.service.js";
import { config } from "./index.js";

// Extrae el JWT desde la cookie "currentUser" en vez de un header Authorization,
// que es lo que pide la consigna (auth por cookie, no por Bearer token).
const cookieExtractor = (req) => {
  return req?.cookies?.currentUser || null;
};

// --- Estrategia de registro ---
// Passport solo adapta la petición: las validaciones y reglas viven en sessions.service.js
passport.use(
  "register",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password", passReqToCallback: true },
    async (req, email, password, done) => {
      try {
        const { first_name, last_name } = req.body;
        const newUser = await sessionsService.registerUser({ first_name, last_name, email, password });
        return done(null, newUser);
      } catch (error) {
        // Los errores (de negocio o no) se derivan al middleware global de errores.
        return done(error);
      }
    }
  )
);

// --- Estrategia de login ---
// Si las credenciales no son válidas devuelve false: el error lo arma authenticateStrategy.
passport.use(
  "login",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await sessionsService.authenticateUser({ email, password });

        if (!user) {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// --- Estrategia current ---
// Lee y verifica el JWT desde la cookie, deja el payload en req.user.
passport.use(
  "current",
  new JwtStrategy(
    {
      jwtFromRequest: cookieExtractor,
      secretOrKey: config.jwt.secret,
    },
    async (payload, done) => {
      try {
        // El payload ya trae { id, email, role }; no hace falta ir a la DB de nuevo.
        return done(null, payload);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Estructurado así (un passport.use por estrategia, todo centralizado acá)
// para poder sumar después estrategias de Google/GitHub sin tocar app.js:
// solo habría que agregar un nuevo passport.use("google", new GoogleStrategy(...))
// en este mismo archivo.

export default passport;
