import { Request, Response } from 'express';
import { IRetencionService } from '../../ports/pagos/service_port/retencion.service.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class RetencionController {
    constructor(private service: IRetencionService) {}

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const conceptos = await this.service.list();
            res.status(200).json({ success: true, data: conceptos });
        } catch (error: any) {
            fail(res, error);
        }
    };

    listarAplicados = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_cuenta_pagar, tipo, desde, hasta } = req.query as any;
            const aplicadas = await this.service.listarAplicados({
                id_cuenta_pagar: id_cuenta_pagar ? Number(id_cuenta_pagar) : undefined,
                tipo, desde, hasta
            });
            res.status(200).json({ success: true, data: aplicadas });
        } catch (error: any) {
            fail(res, error);
        }
    };

    ajustar = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = Number(req.params.id);
            const valorRetenido = Number(req.body.valor_retenido);
            if (!(valorRetenido >= 0)) {
                fail(res, AppError.http(400, 'valor_retenido es requerido y no puede ser negativo'));
                return;
            }
            const actualizada = await this.service.ajustarAplicada(id, valorRetenido);
            res.status(200).json({ success: true, data: actualizada });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
