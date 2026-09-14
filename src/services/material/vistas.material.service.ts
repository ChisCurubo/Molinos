import {
    IVEstadoPagoMaterialRepository, IVEstadoPagoFleteRepository, IVExcedenteEmpresaRepository,
    IVExcedentePorVehiculoRepository, IVAnalisisCompletoRepository, IVEstadoAguaRepository
} from '../../ports/material/repository_port/vistas.material.repository.interface';
import { IVistaMaterialService } from '../../ports/material/service_port/vistas.material.service.interface';

export class VistaMaterialService implements IVistaMaterialService {
    constructor(
        private pagoMat: IVEstadoPagoMaterialRepository,
        private pagoFlete: IVEstadoPagoFleteRepository,
        private excEmp: IVExcedenteEmpresaRepository,
        private excVeh: IVExcedentePorVehiculoRepository,
        private analComp: IVAnalisisCompletoRepository,
        private agua: IVEstadoAguaRepository
    ) {}

    async estadoPagoMaterial(estado?: string): Promise<any[]> {
        return this.pagoMat.findAll(estado);
    }

    async estadoPagoMaterialById(id_entrada: number): Promise<any | null> {
        return this.pagoMat.findByEntrada(id_entrada);
    }

    async estadoPagoFlete(estado?: string): Promise<any[]> {
        return this.pagoFlete.findAll(estado);
    }

    async estadoPagoFleteById(id_entrada: number): Promise<any | null> {
        return this.pagoFlete.findByEntrada(id_entrada);
    }

    async excedenteEmpresa(estado_distribucion?: string): Promise<any[]> {
        return this.excEmp.findAll(estado_distribucion);
    }

    async excedentePorVehiculo(): Promise<any[]> {
        return this.excVeh.findAll();
    }

    async excedentePorVehiculoById(id_vehiculo: number): Promise<any[]> {
        return this.excVeh.findByVehiculo(id_vehiculo);
    }

    async analisisCompleto(id_minero?: number, id_mina?: number, desde?: string, hasta?: string): Promise<any[]> {
        return this.analComp.findAll(id_minero, id_mina, desde, hasta);
    }

    async estadoAgua(estado?: string): Promise<any[]> {
        return this.agua.findAll(estado);
    }
}
