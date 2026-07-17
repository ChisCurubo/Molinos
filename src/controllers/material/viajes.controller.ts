import { Request, Response } from 'express';
import { ViajesService } from '../../services/material/viajes.service';

export class ViajesController {
    constructor(private viajesService: ViajesService) {}

    public crearCabecera = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = await this.viajesService.crearCabeceraViaje(req.body);
            res.status(201).json({ success: true, message: 'Viaje creado', id });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public asignarLinea = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = { ...req.body, id_viaje: parseInt(req.params.id as string) };
            const id = await this.viajesService.asignarLoteAViajeTx(data);
            res.status(201).json({ success: true, message: 'Línea de viaje asignada', id });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public eliminarLinea = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLinea = parseInt(req.params.idLinea as string);
            await this.viajesService.eliminarLineaViajeTx(idLinea);
            res.status(200).json({ success: true, message: 'Línea de viaje eliminada' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
}
