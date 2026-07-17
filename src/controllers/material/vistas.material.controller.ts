import { Request, Response } from 'express';
import {
  VEstadoPagoMaterialRepository, VEstadoPagoFleteRepository,
  VExcedenteEmpresaRepository, VExcedentePorVehiculoRepository,
  VAnalisisCompletoRepository, VEstadoAguaRepository
} from '../../repositories/material/views/vistas.material.repository';

const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any) => res.status(500).json({ success: false, error: e.message || String(e) });

export class VistaMaterialController {
    private pagoMat: VEstadoPagoMaterialRepository;
    private pagoFlete: VEstadoPagoFleteRepository;
    private excEmp: VExcedenteEmpresaRepository;
    private excVeh: VExcedentePorVehiculoRepository;
    private analComp: VAnalisisCompletoRepository;
    private agua: VEstadoAguaRepository;

    constructor(
      pagoMat: VEstadoPagoMaterialRepository,
      pagoFlete: VEstadoPagoFleteRepository,
      excEmp: VExcedenteEmpresaRepository,
      excVeh: VExcedentePorVehiculoRepository,
      analComp: VAnalisisCompletoRepository,
      agua: VEstadoAguaRepository
    ) {
        this.pagoMat = pagoMat;
        this.pagoFlete = pagoFlete;
        this.excEmp = excEmp;
        this.excVeh = excVeh;
        this.analComp = analComp;
        this.agua = agua;
    }

    estadoPagoMaterial = async (req: Request, res: Response) => {
        try { ok(res, await this.pagoMat.findAll(req.query.estado as string)); } catch (e) { err(res, e); }
    };
    estadoPagoMaterialById = async (req: Request, res: Response) => {
        try { ok(res, await this.pagoMat.findByEntrada(Number(req.params.id_entrada))); } catch (e) { err(res, e); }
    };
    estadoPagoFlete = async (req: Request, res: Response) => {
        try { ok(res, await this.pagoFlete.findAll(req.query.estado as string)); } catch (e) { err(res, e); }
    };
    estadoPagoFleteById = async (req: Request, res: Response) => {
        try { ok(res, await this.pagoFlete.findByEntrada(Number(req.params.id_entrada))); } catch (e) { err(res, e); }
    };
    excedenteEmpresa = async (req: Request, res: Response) => {
        try { ok(res, await this.excEmp.findAll(req.query.estado_distribucion as string)); } catch (e) { err(res, e); }
    };
    excedentePorVehiculo = async (req: Request, res: Response) => {
        try { ok(res, await this.excVeh.findAll()); } catch (e) { err(res, e); }
    };
    excedentePorVehiculoById = async (req: Request, res: Response) => {
        try { ok(res, await this.excVeh.findByVehiculo(Number(req.params.id_vehiculo))); } catch (e) { err(res, e); }
    };
    analisisCompleto = async (req: Request, res: Response) => {
        try {
            const { id_minero, id_mina, desde, hasta } = req.query;
            ok(res, await this.analComp.findAll(
                id_minero ? Number(id_minero) : undefined,
                id_mina   ? Number(id_mina)   : undefined,
                desde as string, hasta as string
            ));
        } catch (e) { err(res, e); }
    };
    estadoAgua = async (req: Request, res: Response) => {
        try { ok(res, await this.agua.findAll(req.query.estado as string)); } catch (e) { err(res, e); }
    };
}
