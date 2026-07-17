import { Request, Response } from 'express';
import { MinaRepository } from '../../repositories/material/mina.repository';

import { MinaService, MineroService, ZonaService } from '../../services/material/mina.service';

const ok = (res: Response, data: any, meta?: any) =>
    res.status(200).json({ success: true, data, ...(meta && { meta }) });
const err = (res: Response, error: any, status = 500) =>
    res.status(status).json({ success: false, error: error.message || String(error) });

export class MinaController {
    constructor(
        private minaService: MinaService,
        private mineroService: MineroService,
        private zonaService: ZonaService,
        private repo: MinaRepository // For legacy methods like listarEntradas
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
}
