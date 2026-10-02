import { Request, Response } from 'express';
import { IBonoEmpleadoService } from '../../ports/nomina/service_port/bono_empleado.service.interface';

export class BonoEmpleadoController {
    constructor(private service: IBonoEmpleadoService) {}

    registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const bono = await this.service.registrarBono(req.body);
            res.status(201).json({ success: true, data: bono });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
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
            res.status(500).json({ success: false, message: error.message });
        }
    };

    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const bono = await this.service.obtenerPorId(Number(req.params.id));
            if (!bono) { res.status(404).json({ success: false, message: 'Bono no encontrado' }); return; }
            res.status(200).json({ success: true, data: bono });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.eliminar(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Bono eliminado' });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };
}
