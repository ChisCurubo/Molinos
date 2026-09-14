import { Request, Response } from 'express';
import { IPagoMaterialService } from '../../ports/pagos/service_port/pago_material.service.interface';

export class PagoMaterialController {
    constructor(private service: IPagoMaterialService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    // POST /pagos/material  → crear cuenta de grupo
    crearCuenta = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.crearCuentaTx(req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/material  → tablero de deudas de material
    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.listarCuentas(req.query);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/material/:id  → detalle (totales + volquetas prorrateadas + abonos)
    detalle = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.obtenerDetalle(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // PATCH /pagos/material/:id  → agregar/quitar volquetas, concepto, fecha_limite
    actualizarCuenta = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizarCuentaTx(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/material/:id  → anular cuenta (si no tiene abonos)
    anularCuenta = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.anularCuentaTx(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Cuenta anulada' });
        } catch (e) { this.fail(res, e); }
    };

    // POST /pagos/material/:id/abonos  → registrar una transferencia
    registrarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.registrarAbonoTx(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // PATCH /pagos/material/abonos/:idAbono  → editar un abono
    actualizarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizarAbonoTx(Number(req.params.idAbono), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/material/abonos/:idAbono  → eliminar un abono
    eliminarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.eliminarAbonoTx(Number(req.params.idAbono));
            res.status(200).json({ success: true, message: 'Abono eliminado', data: cuenta });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/material/abonos  → todos los abonos de material, paginados (50 por página)
    listarAbonos = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_minero, desde, hasta, metodo_pago, page, limit } = req.query as any;
            const data = await this.service.listarAbonosPaginado({
                id_minero: id_minero ? Number(id_minero) : undefined,
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
