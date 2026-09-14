import {
    IDeudaRepository, IVEstadoAlquileresRepository, IVEstadoCombustibleRepository,
    IVEstadoMulasRepository, IVSaldosAFavorRepository
} from '../../ports/pagos/repository_port/deuda.repository.interface';
import { IDeudaService } from '../../ports/pagos/service_port/deuda.service.interface';

export class DeudaService implements IDeudaService {
    constructor(
        private repo: IDeudaRepository,
        private alqRepo: IVEstadoAlquileresRepository,
        private combRepo: IVEstadoCombustibleRepository,
        private mulasRepo: IVEstadoMulasRepository,
        private saldosRepo: IVSaldosAFavorRepository
    ) {}

    async deudaMaterialPorMinero(): Promise<any[]> {
        return this.repo.deudaMaterialPorMinero();
    }

    // Compone la deuda bruta/neta del minero (crédito por sobrepago descontado).
    async deudaMaterialDeMinero(id_minero: number): Promise<any> {
        const [entradas, saldo_a_favor] = await Promise.all([
            this.repo.deudaMaterialDeUnMinero(id_minero),
            this.repo.saldoAFavorMinero(id_minero)
        ]);
        const deuda_bruta = entradas.reduce((s: number, e: any) => s + Number(e.saldo_pendiente || 0), 0);
        return {
            id_minero,
            saldo_a_favor,
            deuda_bruta,
            deuda_neta: Math.max(deuda_bruta - saldo_a_favor, 0),
            entradas
        };
    }

    async deudaFletePorDueno(): Promise<any[]> {
        return this.repo.deudaFletePorDueno();
    }

    async deudaFleteDeDueno(id_dueno: number): Promise<any[]> {
        return this.repo.deudaFleteDeUnDueno(id_dueno);
    }

    async resumenGeneral(): Promise<any> {
        return this.repo.resumenGeneral();
    }

    async estadoAlquileres(estado?: string): Promise<any[]> {
        return this.alqRepo.findAll(estado);
    }

    async estadoCombustible(): Promise<any[]> {
        return this.combRepo.findAll();
    }

    async estadoMulas(): Promise<any[]> {
        return this.mulasRepo.findAll();
    }

    async saldosAFavor(): Promise<any[]> {
        return this.saldosRepo.findAll();
    }
}
