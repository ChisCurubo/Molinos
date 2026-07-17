import { Request, Response } from 'express';
import { DeudaRepository } from '../../repositories/pagos/deuda.repository';
import { VEstadoAlquileresRepository, VEstadoCombustibleRepository, VEstadoMulasRepository, VSaldosAFavorRepository } from '../../repositories/pagos/views/vistas.pagos.repository';

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any) => res.status(500).json({ success: false, error: e.message || String(e) });

export class DeudaController {
    constructor(
        private repo: DeudaRepository,
        private alqRepo: VEstadoAlquileresRepository,
        private combRepo: VEstadoCombustibleRepository,
        private mulasRepo: VEstadoMulasRepository,
        private saldosRepo: VSaldosAFavorRepository
    ) {}

    deudaMaterial         = async (_req: Request, res: Response) => { try { ok(res, await this.repo.deudaMaterialPorMinero()); } catch (e) { err(res, e); } };
    deudaMaterialMinero   = async (req: Request, res: Response) => { try { ok(res, await this.repo.deudaMaterialDeUnMinero(Number(req.params.id))); } catch (e) { err(res, e); } };
    deudaFlete            = async (_req: Request, res: Response) => { try { ok(res, await this.repo.deudaFletePorDueno()); } catch (e) { err(res, e); } };
    deudaFleteDueno       = async (req: Request, res: Response) => { try { ok(res, await this.repo.deudaFleteDeUnDueno(Number(req.params.id))); } catch (e) { err(res, e); } };
    resumenGeneral        = async (_req: Request, res: Response) => { try { ok(res, await this.repo.resumenGeneral()); } catch (e) { err(res, e); } };
    estadoAlquileres      = async (req: Request, res: Response) => { try { ok(res, await this.alqRepo.findAll(req.query.estado as string)); } catch (e) { err(res, e); } };
    estadoCombustible     = async (_req: Request, res: Response) => { try { ok(res, await this.combRepo.findAll()); } catch (e) { err(res, e); } };
    estadoMulas           = async (_req: Request, res: Response) => { try { ok(res, await this.mulasRepo.findAll()); } catch (e) { err(res, e); } };
    saldosAFavor          = async (_req: Request, res: Response) => { try { ok(res, await this.saldosRepo.findAll()); } catch (e) { err(res, e); } };
}
