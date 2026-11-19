/**
 * CATÁLOGO DE CÓDIGOS DE ERROR (fuente única de verdad).
 *
 * El campo `code` de toda respuesta de error es uno de estos valores. Son ESTABLES: el front puede hacer
 * `switch (code)` sin miedo a que cambien; el texto (`error`/`message`) sí puede cambiar y es solo para mostrar.
 * Si agregas un código nuevo: añádelo aquí (con su estado HTTP y descripción) y se publica solo en
 * `GET /api/v1/info/errores`, en Swagger y en ESTANDAR_ERRORES.md.
 *
 * Regla de elección del estado HTTP:
 *   4xx = el cliente puede corregirlo (datos, permisos, sesión, regla de negocio).
 *   5xx = falla del servidor o de una dependencia; el cliente no puede arreglarlo, solo reintentar o reportar el `requestId`.
 */
export interface DefCodigo {
    /** Estado HTTP por defecto de este código. */
    status: number;
    /** Qué significa y cuándo se usa (se publica en la documentación). */
    descripcion: string;
    /** Qué debería hacer el front al recibirlo. */
    accionFront: string;
}

export const CODIGOS = {
    // ---- 400: el cliente envió algo que no se puede procesar
    VALIDATION_ERROR:   { status: 400, descripcion: 'Uno o más campos faltan o tienen formato/valor inválido. `details` lista cada campo.', accionFront: 'Marcar los campos de `details[].field` con su `message`.' },
    BAD_REQUEST:        { status: 400, descripcion: 'Solicitud mal formada: JSON inválido, id no numérico, parámetro obligatorio ausente.', accionFront: 'Mostrar `error`; normalmente es un bug del front, no del usuario.' },
    BUSINESS_RULE:      { status: 400, descripcion: 'Los datos son válidos pero la operación no está permitida por una regla del negocio (saldo insuficiente, estado incorrecto, sobrepago...).', accionFront: 'Mostrar `error` al usuario tal cual: ya viene redactado para él.' },
    INVALID_REFERENCE:  { status: 400, descripcion: 'Se refiere a un registro relacionado que no existe (id de categoría, proveedor, empleado... inexistente).', accionFront: 'Refrescar los catálogos/selects: el id enviado ya no existe.' },
    FILE_INVALID:       { status: 400, descripcion: 'Archivo rechazado: no es PDF/PNG/JPG real, está vacío o supera 10 MB.', accionFront: 'Pedir otro archivo; validar tipo y tamaño antes de enviar.' },
    // ---- 401/403: identidad y permisos
    UNAUTHENTICATED:    { status: 401, descripcion: 'Falta la sesión (cookie/token).', accionFront: 'Redirigir al login.' },
    TOKEN_INVALID:      { status: 401, descripcion: 'El token es inválido, está manipulado o fue revocado (logout).', accionFront: 'Cerrar sesión local y redirigir al login.' },
    TOKEN_EXPIRED:      { status: 401, descripcion: 'La sesión venció (8 h).', accionFront: 'Redirigir al login con aviso "sesión vencida".' },
    USER_INACTIVE:      { status: 401, descripcion: 'El usuario fue desactivado o ya no existe.', accionFront: 'Cerrar sesión y avisar que contacte al administrador.' },
    INVALID_CREDENTIALS:{ status: 401, descripcion: 'Usuario o contraseña incorrectos (mensaje único, no revela cuál).', accionFront: 'Mostrar `error` en el formulario de login.' },
    FORBIDDEN:          { status: 403, descripcion: 'La sesión es válida pero el rol no tiene permiso para este recurso/acción.', accionFront: 'Mostrar "sin permiso"; ocultar la acción en el menú.' },
    // ---- 404/409: estado del recurso
    NOT_FOUND:          { status: 404, descripcion: 'El recurso (o la ruta) no existe.', accionFront: 'Mostrar "no encontrado"; si venía de una lista, refrescarla.' },
    DUPLICATE_ENTRY:    { status: 409, descripcion: 'Ya existe un registro con esos datos únicos (código, documento, fecha+empleado...).', accionFront: 'Avisar que ya existe; ofrecer editarlo.' },
    RECORD_IN_USE:      { status: 409, descripcion: 'No se puede borrar/modificar porque otros registros dependen de él.', accionFront: 'Explicar que está en uso; ofrecer desactivarlo en vez de borrarlo.' },
    CONFLICT:           { status: 409, descripcion: 'Conflicto con el estado actual del recurso (otro usuario lo cambió, ya fue procesado).', accionFront: 'Recargar el registro y reintentar.' },
    // ---- 413/429/503: límites y disponibilidad
    PAYLOAD_TOO_LARGE:  { status: 413, descripcion: 'El cuerpo de la petición supera el límite.', accionFront: 'Reducir el tamaño de lo que se envía.' },
    RATE_LIMITED:       { status: 429, descripcion: 'Demasiados intentos en poco tiempo (login, recuperación de contraseña).', accionFront: 'Mostrar espera; usar la cabecera Retry-After si viene.' },
    SERVICE_BUSY:       { status: 503, descripcion: 'El servidor está procesando muchas subidas a la vez.', accionFront: 'Reintentar a los pocos segundos (Retry-After).' },
    SERVICE_UNAVAILABLE:{ status: 503, descripcion: 'Una dependencia (base de datos, almacenamiento) no responde.', accionFront: 'Mostrar "servicio no disponible, reintenta"; no reintentar en bucle.' },
    // ---- 500
    INTERNAL_ERROR:     { status: 500, descripcion: 'Error inesperado del servidor. El detalle técnico NO se envía: está en el log con el `requestId`.', accionFront: 'Mostrar mensaje genérico + el `requestId` para soporte.' },
} as const satisfies Record<string, DefCodigo>;

export type CodigoError = keyof typeof CODIGOS;

/** Código por defecto según el estado HTTP, cuando un error legado trae solo `status`. */
export const codigoPorStatus = (status: number): CodigoError => {
    switch (status) {
        case 400: return 'BAD_REQUEST';
        case 401: return 'UNAUTHENTICATED';
        case 403: return 'FORBIDDEN';
        case 404: return 'NOT_FOUND';
        case 409: return 'CONFLICT';
        case 413: return 'PAYLOAD_TOO_LARGE';
        case 429: return 'RATE_LIMITED';
        case 503: return 'SERVICE_UNAVAILABLE';
        default:  return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
    }
};

export const esCodigo = (c: unknown): c is CodigoError => typeof c === 'string' && c in CODIGOS;
