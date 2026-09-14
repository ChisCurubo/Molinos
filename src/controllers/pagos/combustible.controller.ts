import { Request, Response } from 'express';
import { ICombustibleService } from '../../ports/pagos/service_port/combustible.service.interface';

export class CombustibleController {
    constructor(private service: ICombustibleService) {}

    // GET /pagos/combustible  — lista de consumos/adelantos de combustible (ACPM).
    // Filtros: ?desde&hasta, ?id_gasolinera, ?id_dueno_volqueta, ?tipo_consumo
    public listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { desde, hasta, id_gasolinera, id_dueno_volqueta, tipo_consumo } = req.query as any;
            const data = await this.service.listar({
                desde: desde || undefined,
                hasta: hasta || undefined,
                id_gasolinera: id_gasolinera ? Number(id_gasolinera) : undefined,
                id_dueno_volqueta: id_dueno_volqueta ? Number(id_dueno_volqueta) : undefined,
                tipo_consumo: tipo_consumo || undefined
            });
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    // GET /pagos/combustible/dueno/:id/neto-flete — flete neto del dueño con arrastre de ACPM.
    public netoFletePorDueno = async (req: Request, res: Response): Promise<void> => {
        try {
            const idDueno = Number(req.params.id);
            if (!idDueno) {
                res.status(400).json({ success: false, message: 'ID de dueño inválido' });
                return;
            }
            const data = await this.service.calcularNetoFletePorDueno(idDueno);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    // GET /pagos/combustible/:id
    public obtener = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = Number(req.params.id);
            if (!id) {
                res.status(400).json({ success: false, message: 'ID inválido' });
                return;
            }
            const data = await this.service.obtenerPorId(id);
            if (!data) {
                res.status(404).json({ success: false, message: 'Registro de combustible no encontrado' });
                return;
            }
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };
}
