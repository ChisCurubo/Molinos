import { PoolConnection } from 'mysql2/promise';
import { ICombustibleRepository, CombustibleRow } from '../../ports/pagos/repository_port/combustible.repository.interface';
import { ICombustibleService, SyncAcpmParams } from '../../ports/pagos/service_port/combustible.service.interface';

export { SyncAcpmParams };

export class CombustibleService implements ICombustibleService {
    constructor(private repo: ICombustibleRepository) {}

    // Upsert/borrado idempotente del ACPM de una ENTRADA de material (flete).
    // Se llama dentro de la transacción del registro/edición/borrado de la entrada.
    async sincronizarAcpmEntrada(idEntrada: number, params: SyncAcpmParams, conn: PoolConnection): Promise<void> {
        const acpm = Number(params.acpm) || 0;
        const existente = await this.repo.obtenerAcpmDeEntrada(idEntrada, conn);
        if (acpm > 0) {
            if (existente) {
                await this.repo.actualizarValor(existente.id, acpm, params.comprobante_url, conn);
            } else {
                await this.repo.crear({
                    id_gasolinera: params.id_gasolinera ?? null,
                    tipo_consumo: 'vehiculo',
                    id_dueno_volqueta: params.id_dueno_volqueta ?? null,
                    id_vehiculo: params.id_vehiculo ?? null,
                    id_material_planta_entrada: idEntrada,
                    fecha: params.fecha,
                    descripcion: 'ACPM adelantado (flete)',
                    valor: acpm,
                    comprobante_url: params.comprobante_url ?? null
                }, conn);
            }
        } else if (existente) {
            await this.repo.eliminarPorEntrada(idEntrada, conn);
        }
    }

    // Upsert/borrado idempotente del ACPM de un viaje de AGUA.
    async sincronizarAcpmAgua(idAgua: number, params: SyncAcpmParams, conn: PoolConnection): Promise<void> {
        const acpm = Number(params.acpm) || 0;
        const existente = await this.repo.obtenerAcpmDeAgua(idAgua, conn);
        if (acpm > 0) {
            if (existente) {
                await this.repo.actualizarValor(existente.id, acpm, params.comprobante_url, conn);
            } else {
                await this.repo.crear({
                    id_gasolinera: params.id_gasolinera ?? null,
                    tipo_consumo: 'vehiculo',
                    id_dueno_volqueta: params.id_dueno_volqueta ?? null,
                    id_vehiculo: params.id_vehiculo ?? null,
                    id_agua: idAgua,
                    fecha: params.fecha,
                    descripcion: 'ACPM adelantado (agua)',
                    valor: acpm,
                    comprobante_url: params.comprobante_url ?? null
                }, conn);
            }
        } else if (existente) {
            await this.repo.eliminarPorAgua(idAgua, conn);
        }
    }

    async eliminarAcpmEntrada(idEntrada: number, conn: PoolConnection): Promise<void> {
        await this.repo.eliminarPorEntrada(idEntrada, conn);
    }

    async eliminarAcpmAgua(idAgua: number, conn: PoolConnection): Promise<void> {
        await this.repo.eliminarPorAgua(idAgua, conn);
    }

    async sumaAcpmEntrada(idEntrada: number, conn?: PoolConnection): Promise<number> {
        return this.repo.sumaPorEntrada(idEntrada, conn);
    }

    /**
     * Flete NETO del dueño con arrastre del ACPM (cascada del viaje más viejo al más nuevo).
     * Si el ACPM de un viaje supera su flete, el excedente baja el siguiente viaje del dueño.
     */
    async calcularNetoFletePorDueno(idDueno: number): Promise<any> {
        const fletes = await this.repo.fletesConAcpmPorDueno(idDueno);
        let arrastre = 0;
        const detalle = fletes.map(f => {
            const bruto = Number(f.costo_volqueta) || 0;
            const acpmPropio = Number(f.acpm) || 0;
            const acpmAplicable = acpmPropio + arrastre;      // su ACPM + lo que sobró de viajes previos
            const acpmConsumido = Math.min(bruto, acpmAplicable);
            const fleteNeto = bruto - acpmConsumido;
            arrastre = acpmAplicable - acpmConsumido;          // excedente que pasa al siguiente viaje
            return {
                id_entrada: f.id_entrada,
                fecha_llegada: f.fecha_llegada,
                numero_volqueta: f.numero_volqueta,
                placa: f.placa,
                flete_bruto: bruto,
                acpm: acpmPropio,
                acpm_aplicado: acpmConsumido,
                flete_neto: fleteNeto
            };
        });
        const r2 = (n: number) => Math.round(n * 100) / 100;
        return {
            id_dueno: idDueno,
            total_flete_bruto: r2(detalle.reduce((s, d) => s + d.flete_bruto, 0)),
            total_acpm: r2(detalle.reduce((s, d) => s + d.acpm, 0)),
            total_flete_neto: r2(detalle.reduce((s, d) => s + d.flete_neto, 0)),
            acpm_arrastre_pendiente: r2(arrastre),   // ACPM que quedó sin descontar (adelantado de más)
            fletes: detalle
        };
    }

    async listar(filtros: { desde?: string; hasta?: string; id_gasolinera?: number; id_dueno_volqueta?: number; tipo_consumo?: string }): Promise<CombustibleRow[]> {
        return this.repo.listar(filtros);
    }

    async obtenerPorId(id: number): Promise<CombustibleRow | null> {
        return this.repo.obtenerPorId(id);
    }
}
