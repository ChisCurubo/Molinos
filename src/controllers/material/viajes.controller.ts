import { Request, Response } from 'express';
import { IViajesService } from '../../ports/material/service_port/viajes.service.interface';

export class ViajesController {
    constructor(private viajesService: IViajesService) {}

    // --- LECTURA -------------------------------------------------------------

    // GET /material/viajes — listar viajes con filtros + líneas embebidas + agregados.
    public listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.viajesService.listarViajes(req.query);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/viajes/resumen — KPIs del período.
    public resumen = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.viajesService.resumenViajes(req.query);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/viajes/lote/:id — trazabilidad de un lote en viajes.
    public trazabilidadLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLote = parseInt(req.params.id as string);
            const data = await this.viajesService.trazabilidadPorLote(idLote);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/viajes/:id/trazabilidad — árbol viaje → lotes → materiales de origen.
    public trazabilidadViaje = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            const data = await this.viajesService.trazabilidadDeViaje(id);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/viajes/linea/:id_linea/trazabilidad — línea → lote → materiales de origen.
    public trazabilidadLinea = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLinea = parseInt(req.params.id_linea as string);
            const data = await this.viajesService.trazabilidadDeLinea(idLinea);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/viajes/:id — detalle de un viaje (con líneas completas).
    public obtenerDetalle = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            const data = await this.viajesService.obtenerViajeDetalle(id);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    public crearCabecera = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = await this.viajesService.crearCabeceraViaje(req.body);
            res.status(201).json({ success: true, message: 'Viaje creado', id });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public actualizarViaje = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            if (isNaN(id)) { res.status(400).json({ success: false, message: 'ID de viaje inválido' }); return; }
            const data = await this.viajesService.actualizarCabeceraViajeTx(id, req.body);
            res.status(200).json({ success: true, message: 'Viaje actualizado', data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, message: error.message });
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

    public actualizarLinea = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLinea = parseInt(req.params.idLinea as string);
            if (isNaN(idLinea)) { res.status(400).json({ success: false, message: 'ID de línea inválido' }); return; }
            const data = await this.viajesService.actualizarLineaViajeTx(idLinea, req.body);
            res.status(200).json({ success: true, message: 'Línea de viaje actualizada', data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, message: error.message });
        }
    };

    public eliminarViaje = async (req: Request, res: Response): Promise<void> => {
        try {
            const idViaje = parseInt(req.params.id as string);
            await this.viajesService.eliminarViajeTx(idViaje);
            res.status(200).json({ success: true, message: 'Viaje eliminado (stock devuelto a los lotes)' });
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

    // GET /material/viajes/disponibles-mula — selector: viajes armados (con líneas) y sin despachar.
    public disponiblesParaMula = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.viajesService.listarDisponiblesParaMula();
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
}
