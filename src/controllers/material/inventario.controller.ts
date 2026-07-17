import { Request, Response } from 'express';
import { InventarioService } from '../../services/material/inventario.service';

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any, status = 500) => res.status(status).json({ success: false, error: e.message || String(e) });

export class InventarioController {
    constructor(private service: InventarioService) {}

    public obtenerMaterialCrudo = async (_req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.service.obtenerMaterialCrudo());
        } catch (e) {
            err(res, e);
        }
    };

    public obtenerConcentrado = async (_req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.service.obtenerConcentrado());
        } catch (e) {
            err(res, e);
        }
    };

    public obtenerResumenLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLote = parseInt(req.params.id as string);
            if (isNaN(idLote)) {
                err(res, new Error('ID de lote inválido'), 400);
                return;
            }
            ok(res, await this.service.obtenerResumenLote(idLote));
        } catch (e) {
            err(res, e);
        }
    };
}
