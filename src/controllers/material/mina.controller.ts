import { Request, Response } from 'express';
import { MinaRepository } from '../../repositories/material/mina.repository';

import { IMinaService, IMineroService, IZonaService, ITarifaZonaService, IMinaPrecioMaterialService } from '../../ports/material/service_port/mina.service.interface';

const ok = (res: Response, data: any, meta?: any) =>
    res.status(200).json({ success: true, data, ...(meta && { meta }) });
const err = (res: Response, error: any) =>
    res.status(error?.status || 500).json({ success: false, error: error.message || String(error), ...(error?.code && { code: error.code }) });

export class MinaController {
    constructor(
        private minaService: IMinaService,
        private mineroService: IMineroService,
        private zonaService: IZonaService,
        private repo: MinaRepository, // For legacy methods like listarEntradas
        private tarifaZonaService: ITarifaZonaService,
        private precioMaterialService: IMinaPrecioMaterialService
    ) {}

    list = async (_req: Request, res: Response) => {
        try { ok(res, await this.repo.list()); } catch (e) { err(res, e); }
    };

    getById = async (req: Request, res: Response) => {
        try {
            const data = await this.repo.getById(Number(req.params.id));
            if (!data) return res.status(404).json({ success: false, error: 'Mina no encontrada' });
            ok(res, data);
        } catch (e) { err(res, e); }
    };

    entradas = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.listarEntradas(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    resumen = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.resumen(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    mineros = async (_req: Request, res: Response) => {
        try { ok(res, await this.mineroService.list()); } catch (e) { err(res, e); }
    };

    minerosConMinas = async (_req: Request, res: Response) => {
        try { ok(res, await this.mineroService.listarConMinas()); } catch (e) { err(res, e); }
    };

    zonas = async (_req: Request, res: Response) => {
        try { ok(res, await this.zonaService.list()); } catch (e) { err(res, e); }
    };
    // CRUD Mina
    create = async (req: Request, res: Response) => {
        try { ok(res, await this.minaService.create(req.body)); } catch (e) { err(res, e); }
    };
    update = async (req: Request, res: Response) => {
        try { ok(res, await this.minaService.update(Number(req.params.id), req.body)); } catch (e) { err(res, e); }
    };
    delete = async (req: Request, res: Response) => {
        try { ok(res, await this.minaService.delete(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    // CRUD Minero
    createMinero = async (req: Request, res: Response) => {
        try { ok(res, await this.mineroService.create(req.body)); } catch (e) { err(res, e); }
    };
    updateMinero = async (req: Request, res: Response) => {
        try { ok(res, await this.mineroService.update(Number(req.params.id), req.body)); } catch (e) { err(res, e); }
    };
    deleteMinero = async (req: Request, res: Response) => {
        try { ok(res, await this.mineroService.delete(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    // CRUD Zona
    createZona = async (req: Request, res: Response) => {
        try { ok(res, await this.zonaService.create(req.body)); } catch (e) { err(res, e); }
    };
    updateZona = async (req: Request, res: Response) => {
        try { ok(res, await this.zonaService.update(Number(req.params.id), req.body)); } catch (e) { err(res, e); }
    };
    deleteZona = async (req: Request, res: Response) => {
        try { ok(res, await this.zonaService.delete(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    // CRUD Tarifa_Zona (tarifas de flete por zona)
    listTarifasZona = async (_req: Request, res: Response) => {
        try { ok(res, await this.tarifaZonaService.list()); } catch (e) { err(res, e); }
    };
    getTarifaZona = async (req: Request, res: Response) => {
        try {
            const data = await this.tarifaZonaService.getById(Number(req.params.id));
            if (!data) return res.status(404).json({ success: false, error: 'Tarifa de zona no encontrada' });
            ok(res, data);
        } catch (e) { err(res, e); }
    };
    createTarifaZona = async (req: Request, res: Response) => {
        try { ok(res, await this.tarifaZonaService.create(req.body)); } catch (e) { err(res, e); }
    };
    updateTarifaZona = async (req: Request, res: Response) => {
        try { ok(res, await this.tarifaZonaService.update(Number(req.params.id), req.body)); } catch (e) { err(res, e); }
    };
    deleteTarifaZona = async (req: Request, res: Response) => {
        try { ok(res, await this.tarifaZonaService.delete(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    // CRUD Precio_Material (tabla de referencia)
    listPreciosMaterial = async (_req: Request, res: Response) => {
        try { ok(res, await this.precioMaterialService.list()); } catch (e) { err(res, e); }
    };
    getPrecioMaterial = async (req: Request, res: Response) => {
        try {
            const data = await this.precioMaterialService.getById(Number(req.params.id));
            if (!data) return res.status(404).json({ success: false, error: 'Precio de material no encontrado' });
            ok(res, data);
        } catch (e) { err(res, e); }
    };
    createPrecioMaterial = async (req: Request, res: Response) => {
        try { ok(res, await this.precioMaterialService.create(req.body)); } catch (e) { err(res, e); }
    };
    updatePrecioMaterial = async (req: Request, res: Response) => {
        try { ok(res, await this.precioMaterialService.update(Number(req.params.id), req.body)); } catch (e) { err(res, e); }
    };
    deletePrecioMaterial = async (req: Request, res: Response) => {
        try { ok(res, await this.precioMaterialService.delete(Number(req.params.id))); } catch (e) { err(res, e); }
    };
}
