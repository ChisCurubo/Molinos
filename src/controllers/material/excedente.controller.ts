import { Request, Response } from 'express';
import { IExcedenteService } from '../../ports/material/excedente.interface';

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any) => res.status(e?.status || 500).json({ success: false, error: e.message || String(e), ...(e?.code && { code: e.code }) });

export class ExcedenteController {
    constructor(private service: IExcedenteService) {}

    // GET /material/entradas/:id/excedente — excedente de la entrada (o null).
    public obtener = async (req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.service.obtenerDeEntrada(Number(req.params.id)));
        } catch (e) { err(res, e); }
    };

    // PUT /material/entradas/:id/excedente — registra o actualiza (upsert 1:1) el excedente.
    public registrarOActualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { valor_excedente, tarifa_excedente_por_ton, excedente, fecha_calculo, concepto, notas } = req.body;
            // El panel "editar material" del front envía el FACTOR (× ton secas) bajo la clave `excedente`.
            // El back multiplica: valor_excedente = total_material_seco × factor.
            const tarifa = tarifa_excedente_por_ton ?? excedente;
            const data = await this.service.registrarOActualizar(Number(req.params.id), { valor_excedente, tarifa_excedente_por_ton: tarifa, fecha_calculo, concepto, notas });
            ok(res, data);
        } catch (e) { err(res, e); }
    };
}
