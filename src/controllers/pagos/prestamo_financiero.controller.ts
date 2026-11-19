import { Request, Response } from 'express';
import { IPrestamoFinancieroService } from '../../ports/pagos/service_port/prestamo_financiero.service.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class PrestamoFinancieroController {
    constructor(private service: IPrestamoFinancieroService) {}

    create = async (req: Request, res: Response) => {
        try {
            const data = await this.service.create(req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    getById = async (req: Request, res: Response) => {
        try {
            const data = await this.service.getById(Number(req.params.id));
            if (!data) return fail(res, AppError.http(404, 'Préstamo no encontrado'));
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            fail(res, error);
        }
    };

    update = async (req: Request, res: Response) => {
        try {
            const data = await this.service.update(Number(req.params.id), req.body);
            if (!data) return fail(res, AppError.http(404, 'Préstamo no encontrado o sin cambios'));
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    list = async (req: Request, res: Response) => {
        try {
            const data = await this.service.list();
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            fail(res, error);
        }
    };

    delete = async (req: Request, res: Response) => {
        try {
            const deleted = await this.service.delete(Number(req.params.id));
            if (!deleted) return fail(res, AppError.http(404, 'Préstamo no encontrado'));
            res.status(200).json({ success: true, message: 'Préstamo eliminado' });
        } catch (error: any) {
            fail(res, error);
        }
    };

    proyectarInteres = async (req: Request, res: Response) => {
        try {
            const data = await this.service.proyectarInteres(Number(req.params.id), req.query.fecha as string | undefined);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            fail(res, error);
        }
    };

    acumularInteres = async (req: Request, res: Response) => {
        try {
            const data = await this.service.acumularInteres(Number(req.params.id), req.body?.fecha);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    abonar = async (req: Request, res: Response) => {
        try {
            const data = await this.service.abonar(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    listarMovimientos = async (req: Request, res: Response) => {
        try {
            const data = await this.service.listarMovimientos(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
