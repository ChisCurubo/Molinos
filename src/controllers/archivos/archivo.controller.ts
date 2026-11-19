import { Request, Response } from 'express';
import { IArchivoService } from '../../ports/archivos/file_storage.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class ArchivoController {
    constructor(private service: IArchivoService) {}

    subir = async (req: Request, res: Response): Promise<void> => {
        if (!req.file) { fail(res, AppError.http(400, 'Falta el archivo (campo "archivo")')); return; }
        try {
            res.status(201).json({ success: true, data: await this.service.subir(req.file.buffer, typeof req.query.carpeta === 'string' ? req.query.carpeta : undefined) });
        } catch (e: any) {
            fail(res, e, 400);
        }
    };

    eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.eliminar([].concat((req.params as any).key).join('/'));
            res.json({ success: true, message: 'Archivo eliminado' });
        } catch (e) { fail(res, e); }
    };

    ver = async (req: Request, res: Response): Promise<void> => {
        try {
            const f = await this.service.obtener([].concat((req.params as any).key).join('/'));
            if (!f) { fail(res, AppError.http(404, 'Archivo no encontrado')); return; }
            res.setHeader('Content-Type', f.contentType);
            res.setHeader('Content-Length', f.size);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
            res.setHeader('Content-Disposition', 'inline');
            f.stream.pipe(res);
        } catch {
            fail(res, AppError.http(500, 'No se pudo leer el archivo'));
        }
    };
}
