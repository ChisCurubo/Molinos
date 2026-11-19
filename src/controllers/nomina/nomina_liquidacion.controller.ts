import { Request, Response } from 'express';
import { INominaLiquidacionService } from '../../ports/nomina/service_port/nomina_liquidacion.service.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class NominaLiquidacionController {
    constructor(private service: INominaLiquidacionService) {}

    previsualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_empleado, anio, mes, quincena } = req.query as any;
            if (!id_empleado || !anio || !mes || !quincena) {
                fail(res, AppError.http(400, 'id_empleado, anio, mes y quincena son requeridos'));
                return;
            }
            const preview = await this.service.previsualizar(Number(id_empleado), Number(anio), Number(mes), Number(quincena));
            res.status(200).json({ success: true, data: preview });
        } catch (error: any) {
            fail(res, error);
        }
    };

    previsualizarGrupal = async (req: Request, res: Response): Promise<void> => {
        try {
            const { anio, mes, quincena } = req.query as any;
            if (!anio || !mes || !quincena) {
                fail(res, AppError.http(400, 'anio, mes y quincena son requeridos'));
                return;
            }
            const resultado = await this.service.previsualizarGrupal(Number(anio), Number(mes), Number(quincena));
            res.status(200).json({ success: true, data: resultado });
        } catch (error: any) {
            fail(res, error);
        }
    };

    confirmar = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.confirmar(req.body);
            res.status(201).json({ success: true, data: liquidacion });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    crearBorrador = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.crearBorrador(req.body);
            res.status(201).json({ success: true, data: liquidacion });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    actualizarBorrador = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.actualizarBorrador(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data: liquidacion });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    confirmarBorrador = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.confirmarBorrador(Number(req.params.id));
            res.status(200).json({ success: true, data: liquidacion });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_empleado, anio, mes } = req.query as any;
            const liquidaciones = await this.service.listar({
                id_empleado: id_empleado ? Number(id_empleado) : undefined,
                anio: anio ? Number(anio) : undefined,
                mes: mes ? Number(mes) : undefined
            });
            res.status(200).json({ success: true, data: liquidaciones });
        } catch (error: any) {
            fail(res, error);
        }
    };

    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.obtenerPorId(Number(req.params.id));
            if (!liquidacion) { fail(res, AppError.http(404, 'Liquidación no encontrada')); return; }
            res.status(200).json({ success: true, data: liquidacion });
        } catch (error: any) {
            fail(res, error);
        }
    };

    prestaciones = async (req: Request, res: Response): Promise<void> => {
        try {
            const anio = req.query.anio ? Number(req.query.anio) : new Date().getFullYear();
            const resultado = await this.service.calcularPrestaciones(Number(req.params.id), anio);
            res.status(200).json({ success: true, data: resultado });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
