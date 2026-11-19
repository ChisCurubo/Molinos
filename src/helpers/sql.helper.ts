import { AppError } from '../errors/app-error';
/**
 * Nombre de columna seguro para armar `SET col = ?` / `INSERT (cols)` con claves que vienen del body.
 * Los VALORES siempre van parametrizados; los NOMBRES no se pueden parametrizar, así que solo se
 * aceptan identificadores simples y se entrecomillan. Una clave como "x = (SELECT ...), nombre" lanza error.
 * shortcut: valida forma, no existencia; una columna inexistente falla en MySQL con error normal. No impide
 * escribir columnas válidas pero sensibles (p. ej. `activo`): eso requiere lista por tabla.
 */
export const ident = (k: string): string => {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k)) throw AppError.validacion(`Campo inválido: "${String(k).slice(0, 40)}"`);
    return '`' + k + '`';
};
