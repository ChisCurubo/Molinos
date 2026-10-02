import { PoolConnection } from 'mysql2/promise';
import { ICombustibleRepository, CombustibleRow, CrearCombustibleDTO, ResumenMensualCombustibleRow } from '../../ports/pagos/repository_port/combustible.repository.interface';
import { ICombustibleService, SyncAcpmParams } from '../../ports/pagos/service_port/combustible.service.interface';

export { SyncAcpmParams };

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

function periodoVacio(periodo: string): ResumenMensualCombustibleRow {
    return { periodo, cantidad: 0, total: 0, total_efectivo: 0, total_credito: 0, total_vehiculo: 0, total_planta: 0, total_maquinaria: 0, total_otro: 0 };
}

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
                    forma_pago: 'efectivo',
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
                    forma_pago: 'efectivo',
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

    // Registro manual de un tanqueo/suministro (planta, maquinaria, o vehículo pagado
    // directo, sin pasar por la cascada de ACPM de flete/agua). No se permite atarlo
    // a una entrada o viaje de agua: esas filas las crea únicamente sincronizarAcpm*.
    async registrar(data: CrearCombustibleDTO): Promise<CombustibleRow> {
        const id = await this.repo.crear({ ...data, id_material_planta_entrada: null, id_agua: null });
        return (await this.repo.obtenerPorId(id))!;
    }

    async actualizar(id: number, data: Partial<CrearCombustibleDTO>): Promise<CombustibleRow> {
        const existente = await this.repo.obtenerPorId(id);
        if (!existente) throw err('Registro de combustible no encontrado', 404);
        if (existente.id_material_planta_entrada || existente.id_agua) {
            throw err('Este registro es un ACPM adelantado de flete/agua y se edita desde ese módulo, no aquí', 409);
        }
        const cxp = await this.repo.estadoCxpDeCombustible(id);
        if (cxp.materializado) {
            throw err(cxp.abonado > 0
                ? 'Este consumo ya tiene abonos aplicados en su cuenta por pagar a la gasolinera; no se puede editar aquí'
                : 'Este consumo ya fue agrupado en una cuenta por pagar a la gasolinera; no se puede editar aquí', 409);
        }
        // forma_pago=credito siempre debe tener gasolinera (es a quien se le arma la CxP) — validar
        // el resultado MERGE (existente + lo que llega), no solo el campo que se está tocando.
        const formaResultante = data.forma_pago ?? existente.forma_pago;
        const gasolineraResultante = data.id_gasolinera !== undefined ? data.id_gasolinera : existente.id_gasolinera;
        if (formaResultante === 'credito' && !gasolineraResultante) {
            throw err('Para forma_pago=credito se requiere id_gasolinera (es a quien se le arma la cuenta por pagar)');
        }
        await this.repo.actualizar(id, data);
        return (await this.repo.obtenerPorId(id))!;
    }

    async eliminar(id: number): Promise<void> {
        const existente = await this.repo.obtenerPorId(id);
        if (!existente) throw err('Registro de combustible no encontrado', 404);
        if (existente.id_material_planta_entrada || existente.id_agua) {
            throw err('Este registro es un ACPM adelantado de flete/agua y se elimina desde ese módulo, no aquí', 409);
        }
        const cxp = await this.repo.estadoCxpDeCombustible(id);
        if (cxp.materializado) {
            throw err(cxp.abonado > 0
                ? 'Este consumo ya tiene abonos aplicados en su cuenta por pagar a la gasolinera; no se puede eliminar aquí'
                : 'Este consumo ya fue agrupado en una cuenta por pagar a la gasolinera; no se puede eliminar aquí', 409);
        }
        await this.repo.eliminar(id);
    }

    async resumenMensual(filtros: { anio?: number; forma_pago?: string; tipo_consumo?: string }): Promise<ResumenMensualCombustibleRow[]> {
        return this.repo.resumenMensual(filtros);
    }

    // Dashboard: mes actual vs mes anterior, promedio de los últimos 12 meses,
    // total histórico por forma de pago, y los rankings de gasolinera/dueño.
    async kpis(): Promise<any> {
        const [mensual, topGasolineras, topDuenosAdelanto] = await Promise.all([
            this.repo.resumenMensual({}),
            this.repo.topGasolinerasPorValor(5),
            this.repo.topDuenosPorAdelanto(5)
        ]);

        const hoy = new Date();
        const periodo = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const periodoActual = periodo(hoy);
        const periodoAnterior = periodo(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));

        const mesActual = mensual.find(m => m.periodo === periodoActual) ?? periodoVacio(periodoActual);
        const mesAnterior = mensual.find(m => m.periodo === periodoAnterior) ?? periodoVacio(periodoAnterior);
        const variacionPct = Number(mesAnterior.total) > 0
            ? r2(((Number(mesActual.total) - Number(mesAnterior.total)) / Number(mesAnterior.total)) * 100)
            : null;

        const ultimos12 = mensual.slice(0, 12); // ya viene ordenado DESC por periodo
        const promedioMensualUltimos12 = ultimos12.length
            ? r2(ultimos12.reduce((s, m) => s + Number(m.total), 0) / ultimos12.length)
            : 0;

        const totalHistoricoEfectivo = r2(mensual.reduce((s, m) => s + Number(m.total_efectivo), 0));
        const totalHistoricoCredito = r2(mensual.reduce((s, m) => s + Number(m.total_credito), 0));

        return {
            mes_actual: mesActual,
            mes_anterior: mesAnterior,
            variacion_pct: variacionPct,
            promedio_mensual_ultimos_12: promedioMensualUltimos12,
            total_historico_efectivo: totalHistoricoEfectivo,
            total_historico_credito: totalHistoricoCredito,
            top_gasolineras: topGasolineras,
            top_duenos_adelanto: topDuenosAdelanto,
            meses: mensual
        };
    }
}
