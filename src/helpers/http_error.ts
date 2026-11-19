import { AppError } from '../errors/app-error';

/**
 * @deprecated Usa `AppError` (src/errors/app-error.ts). Se conserva porque ya lo importan servicios existentes:
 * es un `AppError` que acepta el orden antiguo `(status, message, code?)`.
 */
export class HttpError extends AppError {
    constructor(status: number, message: string, code?: string) {
        // Conserva el código de dominio si lo hay (p. ej. 'PRECIO_NO_ENCONTRADO'); si no, deduce uno genérico del status.
        super(code ?? AppError.http(status, message).code, message, { status });
        this.name = 'HttpError';
        Object.setPrototypeOf(this, HttpError.prototype);
    }
}
