import { Request, Response } from 'express';
import { IIngresoTesoreriaService } from '../../ports/pagos/service_port/ingreso_tesoreria.service.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class IngresoTesoreriaController {
    constructor(private service: IIngresoTesoreriaService) {}

    registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const ingreso = await this.service.registrar(req.body);
            res.status(201).json({ success: true, data: ingreso });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_categoria, id_cuenta_bancaria, desde, hasta } = req.query as any;
            const ingresos = await this.service.listar({
                id_categoria: id_categoria ? Number(id_categoria) : undefined,
                id_cuenta_bancaria: id_cuenta_bancaria ? Number(id_cuenta_bancaria) : undefined,
                desde, hasta
            });
            res.status(200).json({ success: true, data: ingresos });
        } catch (error: any) {
            fail(res, error);
        }
    };

    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const ingreso = await this.service.obtenerPorId(Number(req.params.id));
            if (!ingreso) { fail(res, AppError.http(404, 'Ingreso no encontrado')); return; }
            res.status(200).json({ success: true, data: ingreso });
        } catch (error: any) {
            fail(res, error);
        }
    };

    actualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const ingreso = await this.service.actualizar(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data: ingreso });
        } catch (error: any) {
            fail(res, error);
        }
    };

    eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.eliminar(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Ingreso eliminado' });
        } catch (error: any) {
            fail(res, error);
        }
    };

    listarCategorias = async (req: Request, res: Response): Promise<void> => {
        try {
            const categorias = await this.service.listarCategorias();
            res.status(200).json({ success: true, data: categorias });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
