import { Request, Response } from 'express';
import { IGastoDirectoService } from '../../ports/pagos/service_port/gasto_directo.service.interface';

export class GastoDirectoController {
    constructor(private service: IGastoDirectoService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.registrar(req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { desde, hasta } = req.query as any;
            const data = await this.service.listar({ desde, hasta });
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.obtenerPorId(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    editar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.editar(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    anular = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.anular(Number(req.params.id));
            res.status(200).json({ success: true });
        } catch (e) { this.fail(res, e); }
    };
}
