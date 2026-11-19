import { NextFunction, Request, Response } from 'express';
import { codigoPorStatus } from '../errors/codigos';
import { construirCuerpo, idDe } from '../errors/responder';

/**
 * RED DE SEGURIDAD: garantiza que TODA respuesta `{ success: false, ... }` salga con el cuerpo estándar,
 * aunque la haya escrito a mano un controlador viejo (`res.status(404).json({ success:false, message:'...' })`)
 * o un middleware. Hace tres cosas:
 *   - unifica `error` y `message` (los dos llevan el mismo texto),
 *   - agrega `code` (por estado HTTP si no venía), `status` y `requestId`,
 *   - en 5xx NO deja pasar texto técnico: lo manda al log y responde un mensaje genérico.
 * Lo ideal es que los controladores usen `fail(res, e)`; este middleware cubre lo que se escape.
 * No toca las respuestas de éxito.
 */
const MSG_GENERICO = 'Ocurrió un error inesperado. Si persiste, informa el código de referencia (requestId).';

export const estandarizarRespuesta = (req: Request, res: Response, next: NextFunction): void => {
    const jsonOriginal = res.json.bind(res);
    res.json = (body?: any) => {
        if (body && typeof body === 'object' && body.success === false) {
            const status = res.statusCode >= 400 ? res.statusCode : 400;
            // `error` y `message` pueden venir por separado (legado: message='Error interno', error=detalle técnico).
            const texto = String(body.error ?? body.message ?? '');
            const yaEstandar = typeof body.code === 'string' && body.requestId && body.status === status;
            if (!yaEstandar) {
                const inesperado = status >= 500 && !body.code;
                if (inesperado) console.error('[ERR] respuesta 5xx escrita a mano', JSON.stringify({ requestId: idDe(req), ruta: req.originalUrl.split('?')[0], status }), texto);
                body = {
                    ...body,
                    ...construirCuerpo({
                        status,
                        code: typeof body.code === 'string' && body.code ? body.code : codigoPorStatus(status),
                        message: inesperado ? MSG_GENERICO : texto,
                        details: Array.isArray(body.details) ? body.details : undefined,
                    }, idDe(req)),
                };
            }
        }
        return jsonOriginal(body);
    };
    next();
};
