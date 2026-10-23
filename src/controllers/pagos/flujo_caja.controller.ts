import { Request, Response } from 'express';
import { IFlujoCajaService } from '../../ports/pagos/service_port/flujo_caja.service.interface';

export class FlujoCajaController {
    constructor(private service: IFlujoCajaService) {}

    resumenMensual = async (req: Request, res: Response): Promise<void> => {
        try {
            const hoy = new Date();
            const mes = req.query.mes ? Number(req.query.mes) : hoy.getMonth() + 1;
            const anio = req.query.anio ? Number(req.query.anio) : hoy.getFullYear();
            const resumen = await this.service.resumenMensual(mes, anio);
            res.status(200).json({ success: true, data: resumen });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    historico = async (_req: Request, res: Response): Promise<void> => {
        try {
            const historico = await this.service.historico();
            res.status(200).json({ success: true, data: historico });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    anual = async (req: Request, res: Response): Promise<void> => {
        try {
            const anio = req.query.anio ? Number(req.query.anio) : new Date().getFullYear();
            const resumen = await this.service.anual(anio);
            res.status(200).json({ success: true, data: resumen });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    private mesAnioActuales(req: Request): { mes: number; anio: number } {
        const hoy = new Date();
        return {
            mes: req.query.mes ? Number(req.query.mes) : hoy.getMonth() + 1,
            anio: req.query.anio ? Number(req.query.anio) : hoy.getFullYear()
        };
    }

    libroGastos = async (req: Request, res: Response): Promise<void> => {
        try {
            const { mes, anio } = this.mesAnioActuales(req);
            const data = await this.service.libroGastos(mes, anio);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };

    libroCobros = async (req: Request, res: Response): Promise<void> => {
        try {
            const { mes, anio } = this.mesAnioActuales(req);
            const data = await this.service.libroCobros(mes, anio);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 500).json({ success: false, message: error.message });
        }
    };
}
