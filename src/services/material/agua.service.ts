import { CreateAguaPlantaDTO, AguaPlantaSQL, IAguaPlantaRepository } from '../../ports/material/repository_port/agua.repository.interface';
import { IAguaPlantaService } from '../../ports/material/service_port/agua.service.interface';
import { VehiculoRepository } from '../../repositories/material/vehiculo.repository';

export class AguaPlantaService implements IAguaPlantaService {
    private repo: IAguaPlantaRepository;
    private vehiculoRepo: VehiculoRepository;

    constructor(repo: IAguaPlantaRepository, vehiculoRepo: VehiculoRepository) {
        this.repo = repo;
        this.vehiculoRepo = vehiculoRepo;
    }

    async registrar(data: CreateAguaPlantaDTO): Promise<number> {
        if (!data.id_vehiculo) {
            throw new Error('id_vehiculo es requerido');
        }

        const vehiculo = await this.vehiculoRepo.getById(data.id_vehiculo);
        if (!vehiculo) {
            throw new Error('Vehículo no encontrado');
        }

        data.id_dueno_volqueta = vehiculo.dueno_id;

        // valor_total es calculado automáticamente por la DB (columna STORED)

        return await this.repo.registrar(data);
    }

    async actualizar(id: number, data: import('../../ports/material/repository_port/agua.repository.interface').UpdateAguaPlantaDTO): Promise<boolean> {
        return await this.repo.actualizar(id, data);
    }

    async listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]> {
        return await this.repo.listar(fechaDesde, fechaHasta);
    }

    async resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]> {
        return await this.repo.resumenPorDueno(fechaDesde, fechaHasta);
    }

    async listarPorDueno(id_dueno: number): Promise<AguaPlantaSQL[]> {
        return await this.repo.listarPorDueno(id_dueno);
    }

    async resumenPorIdDueno(id_dueno: number): Promise<any> {
        return await this.repo.resumenPorIdDueno(id_dueno);
    }

    async obtenerPorId(id: number): Promise<AguaPlantaSQL | null> {
        return await this.repo.obtenerPorId(id);
    }

    /**
     * Reporte del período agrupado por dueño con arrastre de saldo.
     * neto = valor_total (= bruto - acpm, columna STORED en BD).
     * saldo_inicio = suma de netos de meses ANTERIORES al período (abonos aún no implementados).
     * saldo_fin = saldo_inicio + neto_mes - abonado (abonado = 0 por ahora).
     */
    async reporteMensual(fechaDesde: string, fechaHasta: string): Promise<any> {
        const [viajes, saldos] = await Promise.all([
            this.repo.obtenerViajesPeriodo(fechaDesde, fechaHasta),
            this.repo.obtenerSaldosInicio(fechaDesde)
        ]);

        const saldoInicioPorDueno = new Map<number, number>();
        for (const s of saldos) {
            saldoInicioPorDueno.set(Number(s.id_dueno), Number(s.saldo_inicio) || 0);
        }

        const porDueno = new Map<number, any>();
        for (const v of viajes) {
            const idDueno = Number(v.id_dueno);
            const valorViaje = Number(v.valor_viaje) || 0;
            const cantidad = Number(v.cantidad_viajes) || 0;
            const acpm = Number(v.acpm) || 0;
            const neto = Number(v.valor_total) || 0;
            const bruto = valorViaje * cantidad;

            if (!porDueno.has(idDueno)) {
                const saldoInicio = saldoInicioPorDueno.get(idDueno) || 0;
                porDueno.set(idDueno, {
                    id_dueno: idDueno,
                    dueno: v.dueno,
                    alias: v.alias ?? null,
                    resumen: {
                        num_registros: 0,
                        total_viajes: 0,
                        bruto: 0,
                        acpm: 0,
                        neto_mes: 0,
                        saldo_inicio: saldoInicio,
                        abonado: 0,
                        saldo_fin: saldoInicio
                    },
                    viajes: []
                });
            }

            const grupo = porDueno.get(idDueno);
            grupo.viajes.push({
                id: v.id,
                fecha: v.fecha,
                cantidad_viajes: cantidad,
                valor_viaje: valorViaje,
                bruto,
                acpm,
                neto
            });
            grupo.resumen.num_registros += 1;
            grupo.resumen.total_viajes += cantidad;
            grupo.resumen.bruto += bruto;
            grupo.resumen.acpm += acpm;
            grupo.resumen.neto_mes += neto;
            grupo.resumen.saldo_fin = grupo.resumen.saldo_inicio + grupo.resumen.neto_mes - grupo.resumen.abonado;
        }

        // Redondear a 2 decimales para evitar ruido de floats
        const r2 = (n: number) => Math.round(n * 100) / 100;
        const duenos = Array.from(porDueno.values()).map(g => ({
            ...g,
            resumen: {
                ...g.resumen,
                bruto: r2(g.resumen.bruto),
                acpm: r2(g.resumen.acpm),
                neto_mes: r2(g.resumen.neto_mes),
                saldo_inicio: r2(g.resumen.saldo_inicio),
                saldo_fin: r2(g.resumen.saldo_fin)
            }
        }));

        return { periodo: { desde: fechaDesde, hasta: fechaHasta }, duenos };
    }
}
