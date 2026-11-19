import { Request, Response } from 'express';
import { IBonoEmpleadoService } from '../../ports/nomina/service_port/bono_empleado.service.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class BonoEmpleadoController {
    constructor(private service: IBonoEmpleadoService) {}

    registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const bono = await this.service.registrarBono(req.body);
            res.status(201).json({ success: true, data: bono });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_empleado, desde, hasta } = req.query as any;
            const bonos = await this.service.listar({
                id_empleado: id_empleado ? Number(id_empleado) : undefined,
                desde, hasta
            });
            res.status(200).json({ success: true, data: bonos });
        } catch (error: any) {
            fail(res, error);
        }
    };

    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const bono = await this.service.obtenerPorId(Number(req.params.id));
            if (!bono) { fail(res, AppError.http(404, 'Bono no encontrado')); return; }
            res.status(200).json({ success: true, data: bono });
        } catch (error: any) {
            fail(res, error);
        }
    };

    eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.eliminar(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Bono eliminado' });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
