import { Request, Response } from 'express';
import { IPagoAlquilerService } from '../../ports/pagos/service_port/pago_alquiler.service.interface';

export class PagoAlquilerController {
    constructor(private service: IPagoAlquilerService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    // GET /pagos/alquileres/:id/estado-pago  → saldo, estado y abonos de ese alquiler
    estado = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.estadoAlquiler(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // POST /pagos/alquileres/:id/abonos  → registrar abono (parcial o pago completo)
    registrarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.registrarAbonoTx(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // PATCH /pagos/alquileres/abonos/:idAbono  → editar un abono
    actualizarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizarAbonoTx(Number(req.params.idAbono), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/alquileres/abonos/:idAbono  → eliminar un abono
    eliminarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.eliminarAbonoTx(Number(req.params.idAbono));
            res.status(200).json({ success: true, message: 'Abono eliminado', data: cuenta });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/alquileres/abonos  → todos los abonos de alquiler, paginados (50 por página)
    listarAbonos = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_alquiler, desde, hasta, metodo_pago, page, limit } = req.query as any;
            const data = await this.service.listarAbonosPaginado({
                id_alquiler: id_alquiler ? Number(id_alquiler) : undefined,
                desde: desde || undefined,
                hasta: hasta || undefined,
                metodo_pago: metodo_pago || undefined,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };
}
