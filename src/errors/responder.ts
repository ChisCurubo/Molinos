import { Request, Response } from 'express';
import { AppError, DetalleError } from './app-error';
import { ErrorNormalizado, normalizarError } from './normalizar';

/**
 * CUERPO ESTÁNDAR DE ERROR (el contrato con el front). Ver ESTANDAR_ERRORES.md.
 *
 *   {
 *     "success": false,
 *     "error":   "Texto para el usuario",     // el front debe leer ESTE campo
 *     "message": "Texto para el usuario",     // igual a `error`; se mantiene por compatibilidad con código viejo del front
 *     "code":    "BUSINESS_RULE",             // estable: úsalo para decidir qué hacer (ver catálogo)
 *     "status":  400,                         // el mismo estado HTTP, útil al loguear en el front
 *     "details": [{ "field": "valor", "message": "debe ser mayor a 0" }],   // solo en errores por campo
 *     "requestId": "3f2a..."                  // referencia para soporte; igual a la cabecera X-Request-Id
 *   }
 */
export interface CuerpoError {
    success: false;
    error: string;
    message: string;
    code: string;
    status: number;
    details?: DetalleError[];
    requestId?: string;
}

export const idDe = (req?: Request): string | undefined => (req as any)?.id;

export function construirCuerpo(n: Pick<ErrorNormalizado, 'status' | 'code' | 'message' | 'details'>, requestId?: string): CuerpoError {
    return {
        success: false,
        error: n.message,
        message: n.message,
        code: n.code,
        status: n.status,
        ...(n.details?.length ? { details: n.details } : {}),
        ...(requestId ? { requestId } : {}),
    };
}

/**
 * Deja rastro en el log del servidor. Es lo que usa el equipo para depurar: se busca el `requestId` que
 * reportó el usuario y aparece AQUÍ con quién, qué ruta y (en 5xx) el stack completo.
 */
function registrar(req: Request | undefined, n: ErrorNormalizado, original: unknown): void {
    const ctx = {
        requestId: idDe(req), metodo: req?.method, ruta: req?.originalUrl?.split('?')[0],
        usuario: (req as any)?.user?.id ?? null, status: n.status, code: n.code,
    };
    if (n.inesperado) {
        console.error('[ERR] inesperado', JSON.stringify(ctx), '\n', n.interno ?? (original as any)?.stack ?? original);
    } else {
        console.warn('[ERR]', JSON.stringify({ ...ctx, mensaje: n.message }));
    }
}

/**
 * Responde un error con el cuerpo estándar. ES LA ÚNICA FORMA de responder errores desde un controlador:
 *
 *   try { ... } catch (e) { return fail(res, e); }
 *
 * `e` puede ser cualquier cosa (AppError, Error plano, error de MySQL...); `normalizarError` decide estado y código.
 */
export function fail(res: Response, e: unknown, estadoSugerido?: number): Response {
    // `estadoSugerido` (solo 4xx) aplica ÚNICAMENTE a errores "planos" sin estado propio: lo usan los controladores
    // migrados que antes decían `res.status(404)...` para ese caso. Un AppError/HttpError/MySQL conserva el suyo.
    if (estadoSugerido && estadoSugerido >= 400 && estadoSugerido < 500 && (e as any)?.constructor === Error) {
        e = AppError.http(estadoSugerido, (e as Error).message);
    }
    const n = normalizarError(e);
    registrar(res.req, n, e);
    if (n.status === 429 || n.status === 503) res.setHeader('Retry-After', res.getHeader('Retry-After') ?? '5');
    return res.status(n.status).json(construirCuerpo(n, idDe(res.req)));
}
