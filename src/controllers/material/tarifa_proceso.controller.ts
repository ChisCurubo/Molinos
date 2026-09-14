import { Request, Response } from 'express';
import { ITarifaProcesoService } from '../../ports/material/tarifa_proceso.interface';

const ok = (res: Response, data: any, status = 200) => res.status(status).json({ success: true, data });
const err = (res: Response, e: any, status?: number) =>
    res.status(status || e.status || 500).json({ success: false, error: e.message || String(e) });

export class TarifaProcesoController {
    constructor(private service: ITarifaProcesoService) {}

    public listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const codigo = req.query.codigo as string | undefined;
            const activo = req.query.activo !== undefined ? Number(req.query.activo) : undefined;
            ok(res, await this.service.listar({ codigo, activo }));
        } catch (e) {
            err(res, e);
        }
    };

    public vigentes = async (req: Request, res: Response): Promise<void> => {
        try {
            const fecha = req.query.fecha as string | undefined;
            ok(res, await this.service.obtenerVigentes(fecha));
        } catch (e) {
            err(res, e);
        }
    };

    public crear = async (req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.service.crearNuevaVigencia(req.body), 201);
        } catch (e) {
            err(res, e, 400);
        }
    };

    public actualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            if (isNaN(id)) { err(res, new Error('ID de tarifa inválido'), 400); return; }
            ok(res, await this.service.actualizar(id, req.body));
        } catch (e) {
            err(res, e);
        }
    };
}
