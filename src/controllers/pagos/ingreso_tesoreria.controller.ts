import { Request, Response } from 'express';
import { IIngresoTesoreriaService } from '../../ports/pagos/service_port/ingreso_tesoreria.service.interface';

export class IngresoTesoreriaController {
    constructor(private service: IIngresoTesoreriaService) {}

    registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const ingreso = await this.service.registrar(req.body);
            res.status(201).json({ success: true, data: ingreso });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_categoria, desde, hasta } = req.query as any;
            const ingresos = await this.service.listar({
                id_categoria: id_categoria ? Number(id_categoria) : undefined,
                desde, hasta
            });
            res.status(200).json({ success: true, data: ingresos });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const ingreso = await this.service.obtenerPorId(Number(req.params.id));
            if (!ingreso) { res.status(404).json({ success: false, message: 'Ingreso no encontrado' }); return; }
            res.status(200).json({ success: true, data: ingreso });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    actualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const ingreso = await this.service.actualizar(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data: ingreso });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.eliminar(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Ingreso eliminado' });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    listarCategorias = async (req: Request, res: Response): Promise<void> => {
        try {
            const categorias = await this.service.listarCategorias();
            res.status(200).json({ success: true, data: categorias });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
}
