import { AppError, DetalleError } from './app-error';
import { CODIGOS, CodigoError, codigoPorStatus, esCodigo } from './codigos';

/** Resultado de interpretar CUALQUIER error: lo que el cliente verá y qué hacer con el original. */
export interface ErrorNormalizado {
    status: number;
    code: string;
    /** Texto para mostrar al usuario. En 5xx es siempre genérico. */
    message: string;
    details?: DetalleError[];
    /** true = error inesperado (bug/dependencia caída): se loguea con stack. false = error previsto del cliente. */
    inesperado: boolean;
    /** Texto técnico real, solo para el log del servidor. */
    interno?: string;
}

const MSG_GENERICO = 'Ocurrió un error inesperado. Si persiste, informa el código de referencia (requestId).';

// MySQL errno -> código del catálogo. (database.config.ts ya reemplaza el mensaje por uno seguro y conserva errno.)
const POR_ERRNO: Record<number, { code: CodigoError; status: number }> = {
    1062: { code: 'DUPLICATE_ENTRY', status: 409 },
    1451: { code: 'RECORD_IN_USE', status: 409 },
    1452: { code: 'INVALID_REFERENCE', status: 400 },
    1048: { code: 'VALIDATION_ERROR', status: 400 }, 1364: { code: 'VALIDATION_ERROR', status: 400 },
    1406: { code: 'VALIDATION_ERROR', status: 400 }, 1264: { code: 'VALIDATION_ERROR', status: 400 },
    1265: { code: 'VALIDATION_ERROR', status: 400 }, 1366: { code: 'VALIDATION_ERROR', status: 400 }, 1292: { code: 'VALIDATION_ERROR', status: 400 },
    3819: { code: 'BUSINESS_RULE', status: 400 },
    1644: { code: 'BUSINESS_RULE', status: 400 }, // SIGNAL de un trigger: el mensaje es de negocio y se muestra
};
const ERRORES_RED = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST', 'ECONNRESET'];

// shortcut: heurística transitoria. Servicios viejos lanzan `new Error('X no encontrado')` sin estado; se responde 404.
// Cuando todos lancen AppError.noEncontrado(...) esta regla se puede borrar.
const PARECE_NO_ENCONTRADO = /\b(no\s+(se\s+)?encontr(ó|o|ad[oa]s?)|no\s+existe|no\s+existen)\b/i;

/**
 * Convierte cualquier cosa lanzada en la respuesta estándar. Orden de decisión:
 *  1. AppError / HttpError / errores legados con `status`  -> se respeta su estado y código.
 *  2. Errores conocidos de librerías (JSON roto, JWT, Zod, Multer, MySQL, red).
 *  3. `new Error(msg)` "plano" -> regla de negocio prevista (400, o 404 si dice "no encontrado").
 *  4. Todo lo demás (TypeError, etc.) -> 500 genérico; el detalle va solo al log.
 */
export function normalizarError(e: any): ErrorNormalizado {
    // 0) Errores de body-parser: traen `status` pero su texto es técnico, se reemplaza
    if (e?.type === 'entity.parse.failed' || (e instanceof SyntaxError && 'body' in e)) {
        return { status: 400, code: 'BAD_REQUEST', message: 'El cuerpo de la solicitud no es un JSON válido', inesperado: false };
    }
    if (e?.type === 'entity.too.large') return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la solicitud es demasiado grande', inesperado: false };
    // 1) Errores propios y legados que ya traen estado
    if (e instanceof AppError || (e && typeof e.status === 'number' && e.status >= 400 && e.status < 600)) {
        const status: number = e.status;
        const code = typeof e.code === 'string' && e.code ? e.code : codigoPorStatus(status);
        const inesperado = status >= 500;
        return { status, code, message: inesperado ? MSG_GENERICO : String(e.message ?? ''), details: e.details, inesperado, interno: inesperado ? e.message : undefined };
    }
    // 2) Librerías y base de datos
    if (e?.name === 'TokenExpiredError') return { status: 401, code: 'TOKEN_EXPIRED', message: 'La sesión venció, inicia sesión de nuevo', inesperado: false };
    if (e?.name === 'JsonWebTokenError' || e?.name === 'NotBeforeError') return { status: 401, code: 'TOKEN_INVALID', message: 'Sesión inválida, inicia sesión de nuevo', inesperado: false };
    if (e?.name === 'ZodError' && Array.isArray(e.issues)) {
        return { status: 400, code: 'VALIDATION_ERROR', message: 'Datos inválidos', inesperado: false,
            details: e.issues.map((i: any) => ({ field: (i.path ?? []).join('.'), message: i.message })) };
    }
    if (e?.name === 'MulterError') {
        return { status: 400, code: 'FILE_INVALID', message: e.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera 10 MB' : 'No se pudo procesar el archivo enviado', inesperado: false };
    }
    if (e?.name === 'ArchivoInvalido') return { status: 400, code: 'FILE_INVALID', message: e.message, inesperado: false };
    if (ERRORES_RED.includes(e?.code)) return { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Servicio no disponible, intenta de nuevo en unos segundos', inesperado: true, interno: e.message };
    if (typeof e?.errno === 'number' && (e.sqlState || String(e.code ?? '').startsWith('ER_'))) {
        const m = POR_ERRNO[e.errno];
        if (m) return { status: m.status, code: m.code, message: String(e.message), inesperado: false };
        return { status: 500, code: 'INTERNAL_ERROR', message: MSG_GENERICO, inesperado: true, interno: e.message };
    }
    // 3) Error "plano" lanzado a propósito por un servicio = regla de negocio
    if (e && e.constructor === Error && typeof e.message === 'string' && e.message) {
        if (PARECE_NO_ENCONTRADO.test(e.message)) return { status: 404, code: 'NOT_FOUND', message: e.message, inesperado: false };
        return { status: 400, code: 'BUSINESS_RULE', message: e.message, inesperado: false };
    }
    // 4) Inesperado
    return { status: 500, code: 'INTERNAL_ERROR', message: MSG_GENERICO, inesperado: true, interno: e?.stack ?? String(e) };
}

export { esCodigo, CODIGOS };
