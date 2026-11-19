import { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { factory } from '../config/factory';
import { ArchivoInvalido, MAX_BYTES } from '../services/archivos/archivo.service';
import { fail } from '../errors/responder';
import { AppError } from '../errors/app-error';

/**
 * Permite que un endpoint reciba archivos (PDF/PNG/JPG) junto con sus datos.
 *  - `campos` mapea nombre del campo-archivo -> columna que se llena con la URL de MinIO.
 *  - Los datos van como multipart: campo `datos` con el JSON de siempre (o campos de texto sueltos) + los archivos.
 *  - Una petición JSON normal (sin archivo) sigue funcionando, pero NUNCA se acepta una URL escrita a mano:
 *    las columnas *_url solo se llenan con lo que devuelve el almacenamiento.
 */
// multer guarda cada archivo en memoria: sin tope, varias subidas de 10 MB a la vez agotan la RAM de la VM.
// shortcut: contador por proceso; con varias réplicas el tope es por réplica.
const MAX_SUBIDAS = 4;
let activas = 0;
export const limitarSubidas: RequestHandler = (req, res, next) => {
    if (!req.is('multipart/form-data')) { next(); return; }
    if (activas >= MAX_SUBIDAS) {
        fail(res, new AppError('SERVICE_BUSY', 'Servidor ocupado procesando archivos, reintenta en unos segundos'));
        return;
    }
    activas++;
    let liberada = false;
    const libera = () => { if (!liberada) { liberada = true; activas--; } };
    res.on('finish', libera); res.on('close', libera);
    next();
};

// Columna con punto = campo anidado, p. ej. 'abono.comprobante_url' (POST /cxc lleva el comprobante dentro de `abono`).
const setPath = (o: any, path: string, v: any) => {
    const ks = path.split('.'); const last = ks.pop()!;
    let t = o; for (const k of ks) { if (typeof t[k] !== 'object' || t[k] === null) return; t = t[k]; } // nunca crea el padre: sin abono no hay comprobante que guardar
    if (v === undefined) delete t[last]; else t[last] = v;
};

export const conArchivos = (campos: Record<string, string>): RequestHandler[] => {
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: Object.keys(campos).length } })
        .fields(Object.keys(campos).map(name => ({ name, maxCount: 1 })));

    const parse: RequestHandler = (req, res, next) =>
        upload(req, res, (err: any) => err
            ? fail(res, err) // MulterError -> FILE_INVALID ("supera 10 MB" u otro motivo)
            : next());

    const guardar = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (typeof req.body?.datos === 'string') {
                try { req.body = { ...req.body, ...JSON.parse(req.body.datos) }; delete req.body.datos; }
                catch { fail(res, AppError.validacion('El campo "datos" no es un JSON válido', [{ field: 'datos', message: 'JSON inválido' }])); return; }
            }
            req.body = req.body ?? {};
            const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
            const service = factory.archivos.getArchivoService();
            const subidos: string[] = [];
            const advertencias: string[] = [];
            for (const [campo, columna] of Object.entries(campos)) {
                setPath(req.body, columna, undefined);
                const f = files[campo]?.[0];
                if (!f) continue;
                try {
                    const r = await service.subir(f.buffer);
                    setPath(req.body, columna, r.url);
                    subidos.push(r.key);
                } catch (e: any) {
                    if (e instanceof ArchivoInvalido) throw e; // archivo malo: se rechaza todo
                    // El comprobante es opcional: si el almacenamiento falla, el registro se guarda sin él y se avisa.
                    console.error(`[upload] no se pudo subir "${campo}":`, e.message);
                    advertencias.push(`El registro se guardó, pero la imagen "${campo}" no se pudo subir. Vuelve a adjuntarla después.`);
                }
            }
            // Éxito: avisa lo que no se subió. Error de la operación: borra lo ya subido para no dejar huérfanos.
            const json = res.json.bind(res);
            res.json = (body?: any) => {
                if (res.statusCode >= 400) subidos.forEach(k => service.eliminar(k).catch(() => {}));
                else if (advertencias.length && body && typeof body === 'object') body = { ...body, advertencia: advertencias.join(' ') };
                return json(body);
            };
            next();
        } catch (e: any) {
            fail(res, e); // ArchivoInvalido -> FILE_INVALID (400); fallos inesperados -> 500 genérico
        }
    };

    return [limitarSubidas, parse, guardar];
};

export const upComprobante = conArchivos({ comprobante: 'comprobante_url' });
export const upMula        = conArchivos({ comprobante: 'comprobante_url', foto_factura: 'foto_factura_url' });
export const upCxc        = conArchivos({ comprobante: 'abono.comprobante_url' });
export const upContrato    = conArchivos({ contrato: 'contrato_url' });
export const upAcpm        = conArchivos({ acpm_comprobante: 'acpm_comprobante_url' });
