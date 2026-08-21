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

    public obtener = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = Number(req.params.id);
            if (!id) {
                res.status(400).json({ success: false, message: 'ID inválido' });
                return;
            }
            const viaje = await this.service.obtenerPorId(id);
            if (!viaje) {
                res.status(404).json({ success: false, message: 'Viaje de agua no encontrado' });
                return;
            }
            res.status(200).json({ success: true, data: viaje });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    public reporteMensual = async (req: Request, res: Response): Promise<void> => {
        try {
            let { desde, hasta } = req.query as { desde?: string; hasta?: string };
            const { mes, anio } = req.query as { mes?: string; anio?: string };

            // Si viene mes+anio, se calcula el rango del mes completo
            if (mes && anio) {
                const m = Number(mes);
                const a = Number(anio);
                if (m < 1 || m > 12 || !a) {
                    res.status(400).json({ success: false, message: 'mes (1-12) y anio válidos requeridos' });
                    return;
                }
                const ultimoDia = new Date(a, m, 0).getDate();
                const mm = String(m).padStart(2, '0');
                desde = `${a}-${mm}-01`;
                hasta = `${a}-${mm}-${String(ultimoDia).padStart(2, '0')}`;
            }

            if (!desde || !hasta) {
                res.status(400).json({ success: false, message: 'Se requieren fechas desde y hasta (o mes y anio)' });
                return;
            }

            const reporte = await this.service.reporteMensual(desde, hasta);
            res.status(200).json({ success: true, data: reporte });
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
