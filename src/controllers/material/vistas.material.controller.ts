import { Request, Response } from 'express';
import { IVistaMaterialService } from '../../ports/material/service_port/vistas.material.service.interface';

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any) => res.status(500).json({ success: false, error: e.message || String(e) });

export class VistaMaterialController {
    constructor(private service: IVistaMaterialService) {}

    estadoPagoMaterial = async (req: Request, res: Response) => {
        try { ok(res, await this.service.estadoPagoMaterial(req.query.estado as string)); } catch (e) { err(res, e); }
    };
    estadoPagoMaterialById = async (req: Request, res: Response) => {
        try { ok(res, await this.service.estadoPagoMaterialById(Number(req.params.id_entrada))); } catch (e) { err(res, e); }
    };
    estadoPagoFlete = async (req: Request, res: Response) => {
        try { ok(res, await this.service.estadoPagoFlete(req.query.estado as string)); } catch (e) { err(res, e); }
    };
    estadoPagoFleteById = async (req: Request, res: Response) => {
        try { ok(res, await this.service.estadoPagoFleteById(Number(req.params.id_entrada))); } catch (e) { err(res, e); }
    };
    excedenteEmpresa = async (req: Request, res: Response) => {
        try { ok(res, await this.service.excedenteEmpresa(req.query.estado_distribucion as string)); } catch (e) { err(res, e); }
    };
    excedentePorVehiculo = async (req: Request, res: Response) => {
        try { ok(res, await this.service.excedentePorVehiculo()); } catch (e) { err(res, e); }
    };
    excedentePorVehiculoById = async (req: Request, res: Response) => {
        try { ok(res, await this.service.excedentePorVehiculoById(Number(req.params.id_vehiculo))); } catch (e) { err(res, e); }
    };
    analisisCompleto = async (req: Request, res: Response) => {
        try {
            const { id_minero, id_mina, desde, hasta } = req.query;
            ok(res, await this.service.analisisCompleto(
                id_minero ? Number(id_minero) : undefined,
                id_mina   ? Number(id_mina)   : undefined,
                desde as string, hasta as string
            ));
        } catch (e) { err(res, e); }
    };
    estadoAgua = async (req: Request, res: Response) => {
        try { ok(res, await this.service.estadoAgua(req.query.estado as string)); } catch (e) { err(res, e); }
    };
}
