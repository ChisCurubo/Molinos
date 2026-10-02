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

    delete = async (req: Request, res: Response) => {
        try {
            const deleted = await this.service.delete(Number(req.params.id));
            if (!deleted) return res.status(404).json({ success: false, message: 'Préstamo no encontrado' });
            res.status(200).json({ success: true, message: 'Préstamo eliminado' });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    proyectarInteres = async (req: Request, res: Response) => {
        try {
            const data = await this.service.proyectarInteres(Number(req.params.id), req.query.fecha as string | undefined);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    acumularInteres = async (req: Request, res: Response) => {
        try {
            const data = await this.service.acumularInteres(Number(req.params.id), req.body?.fecha);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    abonar = async (req: Request, res: Response) => {
        try {
            const data = await this.service.abonar(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    listarMovimientos = async (req: Request, res: Response) => {
        try {
            const data = await this.service.listarMovimientos(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };
}
