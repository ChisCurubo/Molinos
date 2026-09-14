import { Request, Response } from 'express';
import { IPagoFleteService } from '../../ports/pagos/service_port/pago_flete.service.interface';

export class PagoFleteController {
    constructor(private service: IPagoFleteService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    // GET /pagos/flete/deuda  → dashboard: deuda por dueño (con positivos de gasolina)
    deuda = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.deudaPorDueno();
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/flete/dueno/:id?mes=&anio=  → estado de cuenta (meses + viajes + abonos)
    estadoCuenta = async (req: Request, res: Response): Promise<void> => {
        try {
            const filtros = {
                mes: req.query.mes ? Number(req.query.mes) : undefined,
                anio: req.query.anio ? Number(req.query.anio) : undefined
            };
            const data = await this.service.estadoCuentaDueno(Number(req.params.id), filtros);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // POST /pagos/flete/dueno/:id/abonos  → abonar en cascada
    registrarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.registrarAbonoDuenoTx(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // PATCH /pagos/flete/abonos/:idAbono  → editar un abono
    actualizarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizarAbonoTx(Number(req.params.idAbono), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/flete/abonos/:idAbono  → eliminar un abono
    eliminarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.eliminarAbonoTx(Number(req.params.idAbono));
            res.status(200).json({ success: true, message: 'Abono eliminado', data: cuenta });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/flete/abonos  → todos los abonos de flete, paginados (50 por página)
    listarAbonos = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_dueno_volqueta, desde, hasta, metodo_pago, page, limit } = req.query as any;
            const data = await this.service.listarAbonosPaginado({
                id_dueno_volqueta: id_dueno_volqueta ? Number(id_dueno_volqueta) : undefined,
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
