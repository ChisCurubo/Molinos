import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';
import { fail } from '../errors/responder';
import { AppError } from '../errors/app-error';

// `handler` en vez de `message`: así el 429 sale con el cuerpo estándar (code RATE_LIMITED, requestId) y cabecera Retry-After.
const base = { standardHeaders: true, legacyHeaders: false };
const msg = (texto: string): { handler: RequestHandler } => ({
    handler: (_req, res) => { fail(res, new AppError('RATE_LIMITED', texto)); },
});

// shortcut: contadores en memoria (1 proceso); con varias réplicas hay que moverlos a un store compartido.
// Cuenta por IP: detrás de Caddy hace falta TRUST_PROXY=1 o todos compartirían la IP del proxy.
export const loginLimiter  = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true,
    ...msg('Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.') });
export const forgotLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 5,
    ...msg('Demasiadas solicitudes de recuperación. Intenta de nuevo en una hora.') });
export const resetLimiter  = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 10,
    ...msg('Demasiados intentos. Intenta de nuevo en una hora.') });
