import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Asigna un identificador a cada petición (`req.id`) y lo devuelve en la cabecera `X-Request-Id`.
 * Es el hilo para depurar: aparece en el cuerpo de todo error (`requestId`), en el log de errores y en el
 * log de accesos (morgan). Si el proxy (Caddy) o el front ya mandan un `X-Request-Id` válido, se respeta
 * para poder seguir la misma petición de punta a punta.
 */
const VALIDO = /^[A-Za-z0-9._-]{8,64}$/; // evita inyectar saltos de línea/caracteres raros en los logs

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
    const entrante = req.header('x-request-id');
    const id = entrante && VALIDO.test(entrante) ? entrante : randomUUID();
    (req as any).id = id;
    res.setHeader('X-Request-Id', id);
    next();
};
