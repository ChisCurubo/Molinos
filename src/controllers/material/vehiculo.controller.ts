import { Request, Response } from 'express';
import { IVehiculoService } from '../../ports/material/service_port/volqueta.service.interface';

// Controller → Service (interfaz) → Repository, según el patrón de capas del proyecto.

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const notFound = (res: Response) => res.status(404).json({ success: false, error: 'Recurso no encontrado' });
const err = (res: Response, e: any) => res.status(500).json({ success: false, error: e.message || String(e) });

export class VehiculoController {
    private service: IVehiculoService;

    constructor(service: IVehiculoService) {
        this.service = service;
    }

    list = async (req: Request, res: Response) => {
        try {
            const todas = req.query.todas === 'true' || req.query.todas === '1';
            ok(res, await this.service.list(todas));
        } catch (e) { err(res, e); }
    };

    getById = async (req: Request, res: Response) => {
        try {
            const data = await this.service.getById(Number(req.params.id));
            if (!data) return notFound(res);
            ok(res, data);
        } catch (e) { err(res, e); }
    };

    create = async (req: Request, res: Response) => {
        try { ok(res, await this.service.create(req.body)); } catch (e) { err(res, e); }
    };

    update = async (req: Request, res: Response) => {
        try { ok(res, await this.service.update(Number(req.params.id), req.body)); } catch (e) { err(res, e); }
    };

    delete = async (req: Request, res: Response) => {
        try { ok(res, await this.service.delete(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    listarPorDueno = async (req: Request, res: Response) => {
        try { ok(res, await this.service.listarPorDueno(Number(req.params.id_dueno))); } catch (e) { err(res, e); }
    };

    listarEntradas = async (req: Request, res: Response) => {
        try { ok(res, await this.service.listarEntradas(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    entradasPendientes = async (req: Request, res: Response) => {
        try { ok(res, await this.service.entradasPendientes(Number(req.params.id))); } catch (e) { err(res, e); }
    };
}
