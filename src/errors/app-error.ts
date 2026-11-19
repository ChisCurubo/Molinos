import { CODIGOS, CodigoError, esCodigo } from './codigos';

/** Un campo con problema, para formularios: `{ field: 'valor', message: 'debe ser mayor a 0' }`. */
export interface DetalleError {
    field: string;
    message: string;
}

/**
 * Error de la aplicación con código estable y estado HTTP. Es lo que deben lanzar servicios y controladores
 * cuando quieren que el cliente reciba un error PREVISTO (el mensaje se muestra tal cual al usuario).
 *
 *   throw AppError.noEncontrado('Cuenta por pagar no encontrada');
 *   throw AppError.reglaNegocio('El abono supera el saldo pendiente');
 *   throw AppError.validacion('Datos inválidos', [{ field: 'valor', message: 'debe ser mayor a 0' }]);
 *
 * Cualquier otro tipo de error (TypeError, fallo de MySQL no mapeado...) se trata como inesperado:
 * se registra completo en el log y el cliente solo ve un mensaje genérico + `requestId`.
 */
export class AppError extends Error {
    /** Código del catálogo (CODIGOS) o un código de DOMINIO específico (p. ej. 'STOCK_INSUFICIENTE'): ambos son estables. */
    public readonly code: string;
    public readonly status: number;
    public readonly details?: DetalleError[];

    constructor(code: CodigoError | (string & {}), message: string, opts: { status?: number; details?: DetalleError[]; cause?: unknown } = {}) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.status = opts.status ?? (esCodigo(code) ? CODIGOS[code].status : 400);
        this.details = opts.details;
        if (opts.cause !== undefined) (this as any).cause = opts.cause;
        Object.setPrototypeOf(this, AppError.prototype);
    }

    // ---- Fábricas: una por situación típica, para que el código que lanza sea corto y legible.
    static validacion(message = 'Datos inválidos', details?: DetalleError[]) { return new AppError('VALIDATION_ERROR', message, { details }); }
    static peticionInvalida(message: string) { return new AppError('BAD_REQUEST', message); }
    static reglaNegocio(message: string) { return new AppError('BUSINESS_RULE', message); }
    static referenciaInvalida(message: string) { return new AppError('INVALID_REFERENCE', message); }
    static noAutenticado(message = 'Debes iniciar sesión') { return new AppError('UNAUTHENTICATED', message); }
    static prohibido(message = 'No tienes permisos para acceder a este recurso') { return new AppError('FORBIDDEN', message); }
    /** Pasa el texto completo para respetar el género: `AppError.noEncontrado('Cuenta por pagar no encontrada')`. */
    static noEncontrado(message = 'Registro no encontrado') { return new AppError('NOT_FOUND', message); }
    static duplicado(message: string) { return new AppError('DUPLICATE_ENTRY', message); }
    static enUso(message: string) { return new AppError('RECORD_IN_USE', message); }
    static conflicto(message: string) { return new AppError('CONFLICT', message); }
    /** Para migrar sitios que ya decían "responde con este status y este texto". */
    static http(status: number, message: string, code?: string, details?: DetalleError[]) {
        const c: string = code ?? (status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
        return new AppError(c, message, { status, details });
    }
}
