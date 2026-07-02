import { Request, Response } from 'express';
import { AguaPlantaService } from '../../services/material/agua.service';

export class AguaPlantaController {
    private service: AguaPlantaService;

    constructor() {
        this.service = new AguaPlantaService();
    }

    public registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = await this.service.registrar(req.body);
            res.status(201).json({ success: true, message: 'Viaje de agua registrado', data: { id } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    public listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { desde, hasta } = req.query;
            if (!desde || !hasta) {
                res.status(400).json({ success: false, message: 'Se requieren fechas desde y hasta' });
                return;
            }
            const viajes = await this.service.listar(desde as string, hasta as string);
            res.status(200).json({ success: true, data: viajes });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    public resumenPorDueno = async (req: Request, res: Response): Promise<void> => {
        try {
            const { desde, hasta } = req.query;
            if (!desde || !hasta) {
                res.status(400).json({ success: false, message: 'Se requieren fechas desde y hasta' });
                return;
            }
            const resumen = await this.service.resumenPorDueno(desde as string, hasta as string);
            res.status(200).json({ success: true, data: resumen });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };
}
