import { Request, Response } from 'express';
import { IMaterialEntradaService, ITipoMaterialService, IPrecioMaterialService, ITarifaCalculoService, IProveedorService, IMinaService } from '../../ports/material/service_port/material.service.interface';
import { MaterialPlantaEntradaService as MaterialEntradaService, TipoMaterialService, PrecioMaterialService, TarifaCalculoService, ProveedorService } from '../../services/material/material.service';
import { MinaService } from '../../services/material/mina.service';
import { CreateMaterialEntradaDTO } from '../../models/material/sql/material_planta_entrada.sql';
import { CreateAnalisisDTO } from '../../models/material/sql/analisis.sql';

// Global repository removed to use DI
const ok = (res: Response, data: any, meta?: any) => res.status(200).json({ success: true, data, ...(meta && { meta }) });
const err = (res: Response, e: any, status = 500) => res.status(status).json({ success: false, error: e.message || String(e) });

export class MaterialEntradaController {
    private service: IMaterialEntradaService;

    constructor(service: IMaterialEntradaService) {
        this.service = service;
    }

    public registrarLlegada = async (req: Request, res: Response): Promise<void> => {
        try {
            const data: CreateMaterialEntradaDTO = req.body;
            if (!data.numero_volqueta || !data.id_mina || !data.id_tipo_material || !data.peso_llegada_planta) {
                res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
                return;
            }
            const id = await this.service.registrarLlegada(data);
            res.status(201).json({ success: true, message: 'Entrada registrada', id });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };


    public listarEntradas = async (req: Request, res: Response): Promise<void> => {
        try {
            const { fechaDesde, fechaHasta, estado, limit, offset } = req.query;
            const entradas = await this.service.listarEntradas(
                (fechaDesde as string) || '2000-01-01',
                (fechaHasta as string) || '2100-01-01',
                (estado as string) || '',
                limit ? parseInt(limit as string) : 100,
                offset ? parseInt(offset as string) : 0
            );
            res.status(200).json({ success: true, data: entradas });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error al listar', error: error.message });
        }
    };

    public pendientesLaboratorio = async (req: Request, res: Response): Promise<void> => {
        try {
            const entradas = await this.service.listarPendientesLaboratorio();
            res.status(200).json({ success: true, data: entradas });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error al listar pendientes', error: error.message });
        }
    };

    public getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.obtenerEntrada(Number(req.params.id));
            if (!data) { res.status(404).json({ success: false, error: 'Entrada no encontrada' }); return; }
            ok(res, data);
        } catch (e) { err(res, e); }
    };

    public listarPorMinero = async (req: Request, res: Response): Promise<void> => {
        try { ok(res, await this.service.listarPorMinero(Number(req.params.id_minero))); } catch (e) { err(res, e); }
    };

    public listarPorMina = async (req: Request, res: Response): Promise<void> => {
        try { ok(res, await this.service.listarPorMina(Number(req.params.id_mina))); } catch (e) { err(res, e); }
    };

    public listarPorVehiculo = async (req: Request, res: Response): Promise<void> => {
        try { ok(res, await this.service.listarPorVehiculo(Number(req.params.id_vehiculo))); } catch (e) { err(res, e); }
    };

    public listarPorDueno = async (req: Request, res: Response): Promise<void> => {
        try { ok(res, await this.service.listarPorDueno(Number(req.params.id_dueno))); } catch (e) { err(res, e); }
    };

    public listarPorFecha = async (req: Request, res: Response): Promise<void> => {
        try { ok(res, await this.service.listarPorFecha(String(req.params.fecha))); } catch (e) { err(res, e); }
    };

    public cambiarEstado = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.actualizarEstado(Number(req.params.id), req.body.estado);
            ok(res, { updated: true });
        } catch (e) { err(res, e); }
    };

    public cancelar = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.body.motivo) { res.status(400).json({ success: false, error: 'motivo es requerido' }); return; }
            await this.service.cancelar(Number(req.params.id), req.body.motivo);
            ok(res, { cancelled: true });
        } catch (e) { err(res, e); }
    };
}

export class TipoMaterialController {
    private service: ITipoMaterialService;
    constructor(service: ITipoMaterialService) { this.service = service; }
    // basic CRUD implementation...
}

export class PrecioMaterialController {
    private service: IPrecioMaterialService;
    constructor(service: IPrecioMaterialService) { this.service = service; }
    
    public buscarPrecio = async (req: Request, res: Response): Promise<void> => {
        try {
            const { idMinero, idZona, metodo, tenorFalso, fechaEntrada } = req.query;
            if (!metodo || !tenorFalso || !fechaEntrada) {
                res.status(400).json({ success: false, message: 'Faltan parámetros: metodo, tenorFalso, fechaEntrada' });
                return;
            }
            const precio = await this.service.buscarPrecio(
                idMinero ? Number(idMinero) : null,
                idZona ? Number(idZona) : null,
                metodo as string,
                Number(tenorFalso),
                fechaEntrada as string
            );
            res.status(200).json({ success: true, data: precio });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    public insertarLote = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.insertarLote(req.body);
            res.status(201).json({ success: true, message: 'Tarifas registradas correctamente' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };
}

export class TarifaCalculoController {
    private service: ITarifaCalculoService;
    constructor(service: ITarifaCalculoService) { this.service = service; }
    // basic CRUD implementation...
}

export class ProveedorController {
    private service: IProveedorService;
    constructor(service: IProveedorService) { this.service = service; }
    // basic CRUD implementation...
}

export class MinaController {
    private service: IMinaService;
    constructor(service: IMinaService) { this.service = service; }
    // basic CRUD implementation...
}