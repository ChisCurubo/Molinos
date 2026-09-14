import { Request, Response } from 'express';
import { IPagoMulaService } from '../../ports/pagos/service_port/pago_mula.service.interface';

export class PagoMulaController {
    constructor(private service: IPagoMulaService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    // POST /pagos/mulas — registrar despacho. Body: { id_proveedor, valor (lo que se debe pagar),
    // fecha?, id_viaje?, concepto?, factura_num?, foto_factura_url? }
    crear = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.crearMulaTx(req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/mulas/resumen?desde=&hasta=&id_proveedor= — KPIs del período
    resumen = async (req: Request, res: Response): Promise<void> => {
        try {
            const { desde, hasta, id_proveedor } = req.query as any;
            const data = await this.service.resumenMulas({
                desde: desde || undefined,
                hasta: hasta || undefined,
                id_proveedor: id_proveedor ? Number(id_proveedor) : undefined
            });
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/mulas/viajes — por viaje: proveedor + cuenta + abonos.
    trazabilidadViajes = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.trazabilidadPorViaje();
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/mulas?id_proveedor=&id_viaje=&estado=
    listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_proveedor, id_viaje, estado } = req.query as any;
            const data = await this.service.listarMulas({
                id_proveedor: id_proveedor ? Number(id_proveedor) : undefined,
                id_viaje: id_viaje ? Number(id_viaje) : undefined,
                estado: estado || undefined
            });
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/mulas/:id
    detalle = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.obtenerMulaDetalle(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // PATCH /pagos/mulas/:id — incluye vincular/desvincular id_viaje
    actualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizarMulaTx(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/mulas/:id — solo si no tiene abonos
    eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.eliminarMulaTx(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Mula eliminada' });
        } catch (e) { this.fail(res, e); }
    };

    // POST /pagos/mulas/proveedor/:idProveedor/abonos — abono en cascada (despacho más viejo primero)
    registrarAbonoProveedor = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.registrarAbonoProveedorTx(Number(req.params.idProveedor), req.body);
            res.status(201).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // PATCH /pagos/mulas/abonos/:idAbono
    actualizarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizarAbonoTx(Number(req.params.idAbono), req.body);
            res.status(200).json({ success: true, data });
        } catch (e) { this.fail(res, e); }
    };

    // DELETE /pagos/mulas/abonos/:idAbono
    eliminarAbono = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.eliminarAbonoTx(Number(req.params.idAbono));
            res.status(200).json({ success: true, message: 'Abono eliminado', data: cuenta });
        } catch (e) { this.fail(res, e); }
    };

    // GET /pagos/mulas/abonos?id_proveedor=&desde=&hasta=&metodo_pago=&page=&limit=
    listarAbonos = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_proveedor, desde, hasta, metodo_pago, page, limit } = req.query as any;
            const data = await this.service.listarAbonosPaginado({
                id_proveedor: id_proveedor ? Number(id_proveedor) : undefined,
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
