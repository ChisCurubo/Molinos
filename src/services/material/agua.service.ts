import { Pool } from 'mysql2/promise';
import { CreateAguaPlantaDTO, AguaPlantaSQL, IAguaPlantaRepository } from '../../ports/material/repository_port/agua.repository.interface';
import { IAguaPlantaService } from '../../ports/material/service_port/agua.service.interface';
import { IVehiculoRepository } from '../../ports/material/repository_port/volqueta.repository.interface';
import { CombustibleService } from '../../services/pagos/combustible.service';

export class AguaPlantaService implements IAguaPlantaService {
    private repo: IAguaPlantaRepository;
    private vehiculoRepo: IVehiculoRepository;
    private db: Pool;
    private combustibleService: CombustibleService;

    constructor(repo: IAguaPlantaRepository, vehiculoRepo: IVehiculoRepository, db: Pool, combustibleService: CombustibleService) {
        this.repo = repo;
        this.vehiculoRepo = vehiculoRepo;
        this.db = db;
        this.combustibleService = combustibleService;
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

        // valor_total es calculado automáticamente por la DB (columna STORED).
        // El ACPM se espeja a Combustible (fuente única de deuda con la gasolinera), en la misma tx.
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const id = await this.repo.registrar(data, conn);
            await this.combustibleService.sincronizarAcpmAgua(id, {
                id_dueno_volqueta: vehiculo.dueno_id ?? null,
                id_vehiculo: data.id_vehiculo ?? null,
                id_gasolinera: data.id_gasolinera ?? null,
                fecha: data.fecha,
                acpm: Number(data.acpm) || 0,
                comprobante_url: data.comprobante_url ?? null
            }, conn);
            await conn.commit();
            return id;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async actualizar(id: number, data: import('../../ports/material/repository_port/agua.repository.interface').UpdateAguaPlantaDTO): Promise<boolean> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const ok = await this.repo.actualizar(id, data, conn);
            // Si cambió el ACPM, se sincroniza la fila espejo en Combustible.
            if (data.acpm !== undefined) {
                const viaje = await this.repo.obtenerPorId(id, conn);
                await this.combustibleService.sincronizarAcpmAgua(id, {
                    id_dueno_volqueta: viaje?.id_dueno ?? null,
                    id_gasolinera: data.id_gasolinera ?? null,
                    fecha: (viaje?.fecha ?? new Date().toISOString().slice(0, 10)) as any,
                    acpm: Number(data.acpm) || 0,
                    comprobante_url: data.comprobante_url ?? undefined
                }, conn);
            }
            await conn.commit();
            return ok;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async eliminar(id: number): Promise<boolean> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            await this.combustibleService.eliminarAcpmAgua(id, conn);
            const ok = await this.repo.eliminar(id, conn);
            await conn.commit();
            return ok;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
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
     * valor_total ahora es BRUTO; el ACPM se deriva de Combustible ⇒ neto = bruto − acpm.
     * saldo_inicio = suma de netos de meses ANTERIORES al período (abonos aún no implementados).
     * saldo_fin = saldo_inicio + neto_mes - abonado (abonado = 0 por ahora).
     */
    async reporteMensual(fechaDesde: string, fechaHasta: string): Promise<any> {
        const [viajes, saldos, abonadoPeriodo, abonadoAntes] = await Promise.all([
            this.repo.obtenerViajesPeriodo(fechaDesde, fechaHasta),
            this.repo.obtenerSaldosInicio(fechaDesde),
            this.repo.abonosAguaPorDueno(fechaDesde, fechaHasta),
            this.repo.abonosAguaAntesPorDueno(fechaDesde)
        ]);

        // saldo_inicio = netos de meses anteriores − abonos de meses anteriores.
        const saldoInicioPorDueno = new Map<number, number>();
        for (const s of saldos) {
            const prevAbono = Number(abonadoAntes.get(Number(s.id_dueno)) || 0);
            saldoInicioPorDueno.set(Number(s.id_dueno), (Number(s.saldo_inicio) || 0) - prevAbono);
        }

        const porDueno = new Map<number, any>();
        for (const v of viajes) {
            const idDueno = Number(v.id_dueno);
            const valorViaje = Number(v.valor_viaje) || 0;
            const cantidad = Number(v.cantidad_viajes) || 0;
            const acpm = Number(v.acpm) || 0;
            const bruto = Number(v.valor_total) || (valorViaje * cantidad);  // valor_total ya es BRUTO
            const neto = Math.max(0, bruto - acpm);   // per-registro, piso 0 (el excedente de ACPM es crédito de gasolina)

            if (!porDueno.has(idDueno)) {
                const saldoInicio = saldoInicioPorDueno.get(idDueno) || 0;
                const abonado = Number(abonadoPeriodo.get(idDueno) || 0);
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
                        abonado,
                        saldo_fin: saldoInicio - abonado
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
