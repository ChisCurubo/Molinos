import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';

const DIR = path.resolve(process.cwd(), 'logs');
const FILE = path.join(DIR, 'auditoria.log');
try { fs.mkdirSync(DIR, { recursive: true }); } catch { /* sin permiso: se audita solo por consola */ }

/**
 * Deja una línea JSON por cada operación que modifica datos (POST/PUT/PATCH/DELETE): quién, qué ruta, resultado.
 * No guarda el cuerpo. shortcut: archivo local sin rotación ni consulta desde la app; si se necesita
 * consultar o conservar mucho tiempo, pasar a una tabla Auditoria o a un colector de logs.
 */
export const auditoria = (req: Request, res: Response, next: NextFunction): void => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
    const t0 = Date.now();
    res.on('finish', () => {
        const linea = JSON.stringify({
            ts: new Date().toISOString(), usuario: req.user?.id ?? null, username: req.user?.username ?? null, rol: req.user?.id_rol ?? null,
            ip: req.ip, metodo: req.method, ruta: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - t0,
        });
        fs.appendFile(FILE, linea + '\n', () => { /* no tumbar la petición por un fallo de log */ });
    });
    next();
};
