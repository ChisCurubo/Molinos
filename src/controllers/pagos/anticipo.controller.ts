import { Request, Response } from 'express';
import { IAnticipoService } from '../../ports/pagos/service_port/anticipo.service.interface';

export class AnticipoController {
    constructor(private service: IAnticipoService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    // POST /pagos/anticipos  { tercero, id, monto, comprobante_url, fecha?, metodo_pago?, descripcion?, observaciones? }
    crear = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.crearAnticipoTx(req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/anticipos?tercero=&id=&estado=
    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { tercero, id, estado } = req.query as any;
            const data = await this.service.listarAnticipos({
                tercero: tercero || undefined,
                id: id ? Number(id) : undefined,
                estado: estado || undefined
            });
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/anticipos/:id
    detalle = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.obtenerAnticipoDetalle(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/anticipos/:id  (solo si monto_usado = 0)
    anular = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.anularAnticipoTx(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Anticipo anulado', data });
        } catch (e) { this.fail(res, e); }
    };
}
