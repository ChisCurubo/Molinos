import { Request, Response } from 'express';
import { AguaPlantaService } from '../../services/material/agua.service';

export class AguaPlantaController {
    private service: AguaPlantaService;

    constructor(service: AguaPlantaService) {
        this.service = service;
    }

    public registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = await this.service.registrar(req.body);
            res.status(201).json({ success: true, message: 'Viaje de agua registrado', data: { id } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };
    public actualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const success = await this.service.actualizar(Number(req.params.id), req.body);
            if (success) {
                res.status(200).json({ success: true, message: 'Viaje de agua actualizado' });
            } else {
                res.status(404).json({ success: false, message: 'Viaje de agua no encontrado' });
            }
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

    public obtenerPorDueno = async (req: Request, res: Response): Promise<void> => {
        try {
            const idDueno = Number(req.params.id_dueno);
            if (!idDueno) {
                res.status(400).json({ success: false, message: 'ID de dueño inválido' });
                return;
            }
            const viajes = await this.service.listarPorDueno(idDueno);
            const resumen = await this.service.resumenPorIdDueno(idDueno);
            
            res.status(200).json({ 
                success: true, 
                data: {
                    resumen: resumen || { total_a_pagar: 0, total_viajes: 0, num_viajes: 0 },
                    viajes
                } 
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };
}
