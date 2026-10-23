import { Request, Response } from 'express';
import { IContratoAlquilerService } from '../../ports/pagos/service_port/contrato_alquiler.service.interface';

export class ContratoAlquilerController {
    constructor(private service: IContratoAlquilerService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.create(req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.getById(Number(req.params.id));
            if (!data) { res.status(404).json({ success: false, error: 'Contrato no encontrado' }); return; }
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.update(Number(req.params.id), req.body);
            if (!data) { res.status(404).json({ success: false, error: 'Contrato no encontrado o sin cambios' }); return; }
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const deleted = await this.service.delete(Number(req.params.id));
            if (!deleted) { res.status(404).json({ success: false, error: 'Contrato no encontrado' }); return; }
            res.status(200).json({ success: true, message: 'Contrato anulado (los meses ya generados no se tocan)' });
        } catch (e) { this.fail(res, e); }
    };

    list = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.list();
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };
}
