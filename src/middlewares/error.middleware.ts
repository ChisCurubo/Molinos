import { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/app-error';
import { fail } from '../errors/responder';

/**
 * Ruta inexistente. Sin esto Express responde una página HTML ("Cannot GET /...") que el front no puede leer.
 * Va después de todas las rutas y antes de `errorHandler`.
 */
export const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
    next(AppError.noEncontrado(`La ruta ${req.method} ${req.originalUrl.split('?')[0]} no existe`));
};

/**
 * Manejador de errores final de Express: recibe lo que lance cualquier ruta o middleware (y, en Express 5,
 * también los rechazos de handlers `async`). Sin él, Express devolvería el stack trace completo al cliente.
 * Toda la lógica de qué estado/código/mensaje corresponde vive en `normalizarError` (src/errors/normalizar.ts).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) { next(err); return; } // ya se empezó a responder: delegar a Express cerrar la conexión
    fail(res, err);
};
