import { Request, Response } from 'express';
import { VehiculoRepository } from '../../repositories/material/vehiculo.repository';

// Global repository removed to use DI

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const notFound = (res: Response) => res.status(404).json({ success: false, error: 'Recurso no encontrado' });
const err = (res: Response, e: any) => res.status(500).json({ success: false, error: e.message || String(e) });

export class VehiculoController {
    private repo: VehiculoRepository;

    constructor(repo: VehiculoRepository) {
        this.repo = repo;
    }

    list = async (_req: Request, res: Response) => {
        try { ok(res, await this.repo.list()); } catch (e) { err(res, e); }
    };

    getById = async (req: Request, res: Response) => {
        try {
            const data = await this.repo.getById(Number(req.params.id));
            if (!data) return notFound(res);
            ok(res, data);
        } catch (e) { err(res, e); }
    };

    create = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.create(req.body)); } catch (e) { err(res, e); }
    };

    update = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.update(Number(req.params.id), req.body)); } catch (e) { err(res, e); }
    };

    delete = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.delete(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    listarPorDueno = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.listarPorDueno(Number(req.params.id_dueno))); } catch (e) { err(res, e); }
    };

    listarEntradas = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.listarEntradas(Number(req.params.id))); } catch (e) { err(res, e); }
    };

    entradasPendientes = async (req: Request, res: Response) => {
        try { ok(res, await this.repo.listarEntradasPendientesFlete(Number(req.params.id))); } catch (e) { err(res, e); }
    };
}
