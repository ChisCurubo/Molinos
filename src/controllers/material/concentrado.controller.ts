import { Request, Response } from 'express';
import { ConcentradoService } from '../../services/material/concentrado.service';

export class ConcentradoController {
    constructor(private concentradoService: ConcentradoService) {}

    public iniciarLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = await this.concentradoService.iniciarLote(req.body);
            res.status(201).json({ success: true, message: 'Lote iniciado', id });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public procesarMaterial = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLote = parseInt(req.params.id as string);
            const { id_entradas, toneladas_procesadas_seco } = req.body;

            if (!id_entradas || !Array.isArray(id_entradas) || id_entradas.length === 0) {
                res.status(400).json({ success: false, message: 'Se requiere un arreglo de id_entradas' });
                return;
            }
            if (!toneladas_procesadas_seco || toneladas_procesadas_seco <= 0) {
                res.status(400).json({ success: false, message: 'Se requiere toneladas_procesadas_seco válido' });
                return;
            }

            const result = await this.concentradoService.procesarLote(idLote, id_entradas, toneladas_procesadas_seco);
            res.status(201).json({ success: true, message: 'Material procesado correctamente', data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public cerrarLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            await this.concentradoService.cerrarLoteConcentradoTx(id, req.body);
            res.status(200).json({ success: true, message: 'Lote cerrado y enviado a canoa' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
}
