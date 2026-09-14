import { Request, Response } from 'express';
import { IDeudaService } from '../../ports/pagos/service_port/deuda.service.interface';

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any) => res.status(500).json({ success: false, error: e.message || String(e) });

export class DeudaController {
    constructor(private service: IDeudaService) {}

    deudaMaterial         = async (_req: Request, res: Response) => { try { ok(res, await this.service.deudaMaterialPorMinero()); } catch (e) { err(res, e); } };
    deudaMaterialMinero   = async (req: Request, res: Response) => {
        try {
            ok(res, await this.service.deudaMaterialDeMinero(Number(req.params.id)));
        } catch (e) { err(res, e); }
    };
    deudaFlete            = async (_req: Request, res: Response) => { try { ok(res, await this.service.deudaFletePorDueno()); } catch (e) { err(res, e); } };
    deudaFleteDueno       = async (req: Request, res: Response) => { try { ok(res, await this.service.deudaFleteDeDueno(Number(req.params.id))); } catch (e) { err(res, e); } };
    resumenGeneral        = async (_req: Request, res: Response) => { try { ok(res, await this.service.resumenGeneral()); } catch (e) { err(res, e); } };
    estadoAlquileres      = async (req: Request, res: Response) => { try { ok(res, await this.service.estadoAlquileres(req.query.estado as string)); } catch (e) { err(res, e); } };
    estadoCombustible     = async (_req: Request, res: Response) => { try { ok(res, await this.service.estadoCombustible()); } catch (e) { err(res, e); } };
    estadoMulas           = async (_req: Request, res: Response) => { try { ok(res, await this.service.estadoMulas()); } catch (e) { err(res, e); } };
    saldosAFavor          = async (_req: Request, res: Response) => { try { ok(res, await this.service.saldosAFavor()); } catch (e) { err(res, e); } };
}
