import { Request, Response } from 'express';
import { IPagoCombustibleService } from '../../ports/pagos/service_port/pago_combustible.service.interface';

export class PagoCombustibleController {
    constructor(private service: IPagoCombustibleService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    // GET /pagos/combustible/pagos/deuda  → dashboard: deuda por gasolinera
    deuda = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.deudaPorGasolinera();
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/combustible/pagos/gasolinera/:id?mes=&anio=  → estado de cuenta (meses + consumos + abonos)
    estadoCuenta = async (req: Request, res: Response): Promise<void> => {
        try {
            const filtros = {
                mes: req.query.mes ? Number(req.query.mes) : undefined,
                anio: req.query.anio ? Number(req.query.anio) : undefined
            };
            const data = await this.service.estadoCuentaGasolinera(Number(req.params.id), filtros);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // POST /pagos/combustible/pagos/gasolinera/:id/abonos  → abonar en cascada
    registrarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.registrarAbonoGasolineraTx(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // PATCH /pagos/combustible/pagos/abonos/:idAbono  → editar un abono
    actualizarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizarAbonoTx(Number(req.params.idAbono), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/combustible/pagos/abonos/:idAbono  → eliminar un abono
    eliminarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.eliminarAbonoTx(Number(req.params.idAbono));
            res.status(200).json({ success: true, message: 'Abono eliminado', data: cuenta });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/combustible/pagos/abonos  → todos los abonos de combustible, paginados (50 por página)
    listarAbonos = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_gasolinera, desde, hasta, metodo_pago, page, limit } = req.query as any;
            const data = await this.service.listarAbonosPaginado({
                id_gasolinera: id_gasolinera ? Number(id_gasolinera) : undefined,
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
