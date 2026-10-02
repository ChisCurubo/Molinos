import { Request, Response } from 'express';
import { INominaLiquidacionService } from '../../ports/nomina/service_port/nomina_liquidacion.service.interface';

export class NominaLiquidacionController {
    constructor(private service: INominaLiquidacionService) {}

    previsualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_empleado, anio, mes, quincena } = req.query as any;
            if (!id_empleado || !anio || !mes || !quincena) {
                res.status(400).json({ success: false, message: 'id_empleado, anio, mes y quincena son requeridos' });
                return;
            }
            const preview = await this.service.previsualizar(Number(id_empleado), Number(anio), Number(mes), Number(quincena));
            res.status(200).json({ success: true, data: preview });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    previsualizarGrupal = async (req: Request, res: Response): Promise<void> => {
        try {
            const { anio, mes, quincena } = req.query as any;
            if (!anio || !mes || !quincena) {
                res.status(400).json({ success: false, message: 'anio, mes y quincena son requeridos' });
                return;
            }
            const resultado = await this.service.previsualizarGrupal(Number(anio), Number(mes), Number(quincena));
            res.status(200).json({ success: true, data: resultado });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    confirmar = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.confirmar(req.body);
            res.status(201).json({ success: true, data: liquidacion });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    crearBorrador = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.crearBorrador(req.body);
            res.status(201).json({ success: true, data: liquidacion });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    actualizarBorrador = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.actualizarBorrador(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data: liquidacion });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    confirmarBorrador = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.confirmarBorrador(Number(req.params.id));
            res.status(200).json({ success: true, data: liquidacion });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
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
            res.status(500).json({ success: false, message: error.message });
        }
    };

    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const liquidacion = await this.service.obtenerPorId(Number(req.params.id));
            if (!liquidacion) { res.status(404).json({ success: false, message: 'Liquidación no encontrada' }); return; }
            res.status(200).json({ success: true, data: liquidacion });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    prestaciones = async (req: Request, res: Response): Promise<void> => {
        try {
            const anio = req.query.anio ? Number(req.query.anio) : new Date().getFullYear();
            const resultado = await this.service.calcularPrestaciones(Number(req.params.id), anio);
            res.status(200).json({ success: true, data: resultado });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };
}
