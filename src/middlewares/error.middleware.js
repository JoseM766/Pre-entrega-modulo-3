import { config } from "../config/index.js";
import {
  AppError,
  InvalidJsonError,
  ValidationError,
  DuplicateKeyError,
  DatabaseError,
  InternalServerError,
  RouteNotFoundError,
} from "../errors/index.js";

// Los controllers, middlewares y services NUNCA responden errores: los lanzan o llaman next(error).
// La respuesta de error de toda la API sale únicamente de acá.

// Cualquier cosa que llegue (error propio, error de Express, de Mongoose o inesperado)
// se convierte en un AppError conocido.
const normalizeError = (error) => {
  if (error instanceof AppError) return error;

  // JSON mal formado en el body (lo detecta express.json)
  if (error?.type === "entity.parse.failed") {
    return new InvalidJsonError(undefined, error.message);
  }

  // Errores de Mongoose / MongoDB que se escaparon de un repository
  if (error?.code === 11000) {
    return new DuplicateKeyError(undefined, JSON.stringify(error.keyValue ?? {}));
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return new ValidationError(undefined, error.message);
  }
  if (/^Mongo/.test(error?.name ?? "")) {
    return new DatabaseError(undefined, error.message);
  }

  return new InternalServerError(undefined, error?.message);
};

// Ruta inexistente: se registra después de todas las rutas y antes de errorHandler.
export const notFoundHandler = (req, res, next) => {
  next(new RouteNotFoundError(undefined, `${req.method} ${req.originalUrl}`));
};

// Middleware de errores de Express (4 parámetros). Debe registrarse al final de app.js.
export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const appError = normalizeError(error);

  // Los errores de servidor se registran completos en consola, pero nunca se le muestran al cliente.
  if (appError.statusCode >= 500) {
    console.error(error);
  }

  const body = {
    status: "error",
    error: appError.code,
    message: appError.message,
  };

  // details (debugging) solo fuera de producción
  if (appError.details && !config.isProduction) {
    body.details = appError.details;
  }

  res.status(appError.statusCode).json(body);
};
