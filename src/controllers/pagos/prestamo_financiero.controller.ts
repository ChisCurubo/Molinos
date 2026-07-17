import { Request, Response } from 'express';
import { IPrestamoFinancieroService } from '../../ports/pagos/service_port/prestamo_financiero.service.interface';

export class PrestamoFinancieroController {
    constructor(private service: IPrestamoFinancieroService) {}

    create = async (req: Request, res: Response) => {
        try {
            const data = await this.service.create(req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    };

    getById = async (req: Request, res: Response) => {
        try {
            const data = await this.service.getById(Number(req.params.id));
            if (!data) return res.status(404).json({ success: false, message: 'Préstamo no encontrado' });
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    update = async (req: Request, res: Response) => {
        try {
            const data = await this.service.update(Number(req.params.id), req.body);
            if (!data) return res.status(404).json({ success: false, message: 'Préstamo no encontrado o sin cambios' });
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    };

    list = async (req: Request, res: Response) => {
        try {
            const data = await this.service.list();
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
}
