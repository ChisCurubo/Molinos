import { Pool, PoolConnection } from 'mysql2/promise';
import { IPagoFleteRepository } from '../../ports/pagos/repository_port/pago_flete.repository.interface';
import { IPagoFleteService } from '../../ports/pagos/service_port/pago_flete.service.interface';
import { CombustibleService } from './combustible.service';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

// Año/mes de una fecha que puede venir como Date o 'YYYY-MM-DD'.
function anioMes(fecha: any): { anio: number; mes: number } {
    const s = typeof fecha === 'string' ? fecha : new Date(fecha).toISOString();
    const [y, m] = s.slice(0, 10).split('-').map(Number);
    return { anio: y, mes: m };
}
const estadoEntradaDesdeCuenta = (estadoCuenta: string): string =>
    estadoCuenta === 'anulado' ? 'pendiente' : estadoCuenta;
// 'YYYY-MM' desde un DATE de MySQL (que mysql2 devuelve como Date) o un string.
function periodoDe(fecha: any): string {
    if (fecha instanceof Date) return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    return String(fecha).slice(0, 7);
}

/**
 * Pago de FLETE al dueño de volqueta. Se agrupa por (dueño, mes) en Cuentas_Por_Pagar y se abona
 * en cascada del mes más viejo al más nuevo. El valor de cada viaje es su flete NETO
 * (costo_volqueta − ACPM, con arrastre del ACPM sobrante entre viajes del dueño → CombustibleService).
 * Trazabilidad: cada Relacion queda atada a su id_entrada con su ACPM propio visible.
 * Efecto extra (§6): al abonar se actualiza estado_pago_flete de cada viaje y Volqueta_Vehiculo.estado_pago.
 */
export class PagoFleteService implements IPagoFleteService {
    constructor(
        private repo: IPagoFleteRepository,
        private combustible: CombustibleService,
        private db: Pool
    ) {}

    // ── Materialización: arma las cuentas mensuales con los fletes aún sin cuenta ──
    private async materializar(idDueno: number, conn: PoolConnection): Promise<void> {
        const neto = await this.combustible.calcularNetoFletePorDueno(idDueno);
        const yaEn = new Set(await this.repo.idsEntradasConRelacionFlete(idDueno, conn));
        const fletes = await this.repo.fletesPayablesDelDueno(idDueno, conn);
        const vehMap = new Map<number, number>(fletes.map(f => [Number(f.id_entrada), Number(f.id_vehiculo)]));

        const cuentaCache = new Map<string, number>();
        const cuentasTocadas = new Set<number>();
        const vehiculosTocados = new Set<number>();

        for (const f of neto.fletes) {
            const idEntrada = Number(f.id_entrada);
            if (yaEn.has(idEntrada)) continue;
            const vId = vehMap.get(idEntrada);
            if (vId) vehiculosTocados.add(vId);

            const montoNeto = r2(Number(f.flete_neto));
            if (montoNeto <= 0) {
                // Viaje saldado por completo con ACPM adelantado → nada que pagar.
                await this.repo.actualizarEstadoFleteEntradas([idEntrada], 'pagado', conn);
                continue;
            }

            const { anio, mes } = anioMes(f.fecha_llegada);
            const key = `${anio}-${mes}`;
            let idCxp = cuentaCache.get(key);
            if (!idCxp) {
                idCxp = (await this.repo.buscarCuentaMesFlete(idDueno, anio, mes, conn)) ?? undefined as any;
                if (!idCxp) {
                    const mm = String(mes).padStart(2, '0');
                    idCxp = await this.repo.crearCuentaFlete({
                        id_dueno_volqueta: idDueno,
                        concepto: `Flete volqueta ${anio}-${mm}`,
                        valor_total: 0,
                        fecha_creacion: `${anio}-${mm}-01`
                    }, conn);
                }
                cuentaCache.set(key, idCxp);
            }
            await this.repo.crearRelacionFlete(idCxp, idEntrada, montoNeto, `Volqueta ${f.numero_volqueta}`, conn);
            await this.repo.sumarValorTotal(idCxp, montoNeto, conn);
            cuentasTocadas.add(idCxp);
        }

        for (const idCxp of cuentasTocadas) {
            await this.repo.recalcularCuenta(idCxp, conn);
            await this.aplicarEfectoFlete(idCxp, conn);
        }
        await this.repo.recomputarEstadoVehiculos([...vehiculosTocados], conn);
    }

    // Propaga el estado de la cuenta a cada viaje (estado_pago_flete) y a sus vehículos.
    private async aplicarEfectoFlete(idCxp: number, conn: PoolConnection): Promise<void> {
        const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
        if (!cuenta) return;
        const estado = estadoEntradaDesdeCuenta(cuenta.estado);
        const rels = await this.repo.entradasYVehiculosDeCuenta(idCxp, conn);
        await this.repo.actualizarEstadoFleteEntradas(rels.map(r => r.id_entrada), estado, conn);
        await this.repo.recomputarEstadoVehiculos(rels.map(r => r.id_vehiculo), conn);
    }

    // ── Dashboard: cuánto le debo a cada dueño (con ambos "positivos de gasolina") ──
    async deudaPorDueno(): Promise<any[]> {
        const [duenos, abonadoMap] = await Promise.all([
            this.repo.duenosConFlete(),
            this.repo.abonadoFletePorDueno()
        ]);
        const out: any[] = [];
        for (const d of duenos) {
            const neto = await this.combustible.calcularNetoFletePorDueno(Number(d.id));
            const abonado = Number(abonadoMap.get(Number(d.id)) || 0);
            const saldo = r2(Number(neto.total_flete_neto) - abonado);
            const creditoSobrepago = await this.repo.sumaCreditoDisponibleDueno(Number(d.id));
            out.push({
                id: d.id, nombre: d.nombre, alias: d.alias,
                banco: d.banco, numero_cuenta: d.numero_cuenta, nequi: d.nequi,
                flete_bruto_total: neto.total_flete_bruto,
                acpm_total: neto.total_acpm,
                flete_neto_total: neto.total_flete_neto,
                abonado,
                saldo_pendiente: saldo < 0 ? 0 : saldo,
                credito_gasolina: neto.acpm_arrastre_pendiente,   // ACPM adelantado de más (positivo de gasolina)
                credito_sobrepago: r2(creditoSobrepago)           // sobrepago de abonos (saldo a favor)
            });
        }
        return out.filter(x => x.saldo_pendiente > 0 || x.credito_gasolina > 0 || x.credito_sobrepago > 0)
                  .sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
    }

    // ── Estado de cuenta de un dueño (meses + viajes + abonos) ──────────────
    async estadoCuentaDueno(idDueno: number, filtros: { mes?: number; anio?: number } = {}): Promise<any> {
        // 1) Materializar en su propia transacción.
        await this.tx(async conn => { await this.materializar(idDueno, conn); });

        // 2) Leer las cuentas del dueño (con filtro opcional de mes/año).
        const cuentas = await this.repo.cuentasDelDueno(idDueno, filtros.anio, filtros.mes);
        const meses = [];
        for (const c of cuentas) {
            const [viajes, abonos] = await Promise.all([
                this.repo.relacionesConProrrateo(c.id),
                this.repo.listarAbonos(c.id)
            ]);
            meses.push({
                id_cuenta: c.id, concepto: c.concepto, periodo: periodoDe(c.fecha_creacion),
                valor_total: c.valor_total, valor_pagado: c.valor_pagado, saldo: c.saldo, estado: c.estado,
                num_viajes: viajes.length, viajes, abonos
            });
        }

        const neto = await this.combustible.calcularNetoFletePorDueno(idDueno);
        const totalPagado = meses.reduce((s, m) => s + Number(m.valor_pagado), 0);
        const totalSaldo = meses.reduce((s, m) => s + Number(m.saldo), 0);
        const creditoSobrepago = await this.repo.sumaCreditoDisponibleDueno(idDueno);

        return {
            id_dueno: idDueno,
            resumen: {
                flete_bruto_total: neto.total_flete_bruto,
                acpm_total: neto.total_acpm,
                flete_neto_total: neto.total_flete_neto,
                total_pagado: r2(totalPagado),
                saldo_pendiente: r2(totalSaldo),
                credito_gasolina: neto.acpm_arrastre_pendiente,   // positivo de gasolina (ACPM adelantado)
                credito_sobrepago: r2(creditoSobrepago)           // saldo a favor por sobrepago de abonos
            },
            meses
        };
    }

    // ── Abonar en cascada (monto libre, comprobante obligatorio) ────────────
    async registrarAbonoDuenoTx(idDueno: number, data: any): Promise<any> {
        const valor = r2(Number(data.valor));
        if (!(valor > 0)) throw err('El valor del abono debe ser mayor a 0');
        const comprobante = (data.comprobante_url ?? '').toString().trim();
        if (!comprobante) throw err('Cada abono requiere el comprobante (comprobante_url)');
        const fecha = data.fecha_abono || new Date().toISOString().slice(0, 10);

        return this.tx(async conn => {
            await this.materializar(idDueno, conn);
            const cuentas = await this.repo.cuentasAbiertasDelDueno(idDueno, conn);

            let restante = valor;
            let ultimoAbono: number | null = null;
            const aplicado: any[] = [];
            for (const c of cuentas) {
                if (restante <= 0) break;
                const saldo = r2(Number(c.valor_total) - Number(c.valor_pagado));
                if (saldo <= 0) continue;
                const monto = r2(Math.min(restante, saldo));
                const idAbono = await this.repo.insertarAbono({
                    id_cuenta_pagar: c.id, fecha_abono: fecha, valor: monto,
                    metodo_pago: data.metodo_pago || 'transferencia',
                    comprobante_url: comprobante, observaciones: data.observaciones
                }, conn);
                ultimoAbono = idAbono;
                await this.repo.recalcularCuenta(c.id, conn);
                await this.aplicarEfectoFlete(c.id, conn);
                const cuenta = await this.repo.obtenerCuenta(c.id, conn);
                aplicado.push({ id_cuenta: c.id, periodo: periodoDe(c.fecha_creacion), aplicado: monto, estado: cuenta.estado });
                restante = r2(restante - monto);
            }

            if (aplicado.length === 0) {
                throw err('El dueño no tiene deuda de flete pendiente; no hay a qué aplicar el abono', 409);
            }

            let saldoAFavor = 0;
            if (restante > 0) {
                // Sobrepago → crédito reutilizable del dueño (positivo por abono).
                await this.repo.crearSaldoAFavorDueno({
                    id_abono_cxp_orig: ultimoAbono,
                    id_dueno_volqueta: idDueno,
                    monto_original: restante,
                    descripcion: `Sobrepago de flete (abono #${ultimoAbono})`
                }, conn);
                saldoAFavor = restante;
            }

            return { aplicado_a: aplicado, total_aplicado: r2(valor - saldoAFavor), saldo_a_favor_generado: saldoAFavor };
        });
    }

    // ── Editar un abono de flete ────────────────────────────────────────────
    async actualizarAbonoTx(idAbono: number, data: any): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeFlete(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de flete', 400);
            }
            if (abono.metodo_pago === 'saldo_a_favor') {
                throw err('Un descuento de saldo a favor no se edita; elimínalo y vuelve a aplicarlo', 409);
            }
            if (await this.repo.saldoAFavorPorAbono(idAbono, conn)) {
                throw err('Este abono generó un saldo a favor; elimínalo y regístralo de nuevo con el valor correcto', 409);
            }
            const idCxp = Number(abono.id_cuenta_pagar);
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (!cuenta || cuenta.estado === 'anulado') throw err('La cuenta está anulada o no existe', 409);

            const campos: any = {};
            if (data.fecha_abono !== undefined) campos.fecha_abono = data.fecha_abono;
            if (data.metodo_pago !== undefined) {
                if (data.metodo_pago === 'saldo_a_favor') throw err('El método saldo_a_favor no está soportado aquí');
                campos.metodo_pago = data.metodo_pago;
            }
            if (data.comprobante_url !== undefined) {
                const comp = (data.comprobante_url ?? '').toString().trim();
                if (!comp) throw err('El comprobante (comprobante_url) no puede quedar vacío');
                campos.comprobante_url = comp;
            }
            if (data.observaciones !== undefined) campos.observaciones = data.observaciones;
            if (data.valor !== undefined) {
                const nuevo = r2(Number(data.valor));
                if (!(nuevo > 0)) throw err('El valor del abono debe ser mayor a 0');
                const otros = await this.repo.sumaOtrosAbonos(idCxp, idAbono, conn);
                if (nuevo + otros > Number(cuenta.valor_total) + 1e-6) {
                    throw err(`El abono deja el total pagado (${r2(nuevo + otros)}) por encima del valor de la cuenta (${cuenta.valor_total})`, 409);
                }
                campos.valor = nuevo;
            }

            await this.repo.actualizarAbono(idAbono, campos, conn);
            await this.repo.recalcularCuenta(idCxp, conn);
            await this.aplicarEfectoFlete(idCxp, conn);
            const ab = await this.repo.obtenerAbono(idAbono, conn);
            const cta = await this.repo.obtenerCuenta(idCxp, conn);
            return { abono: ab, cuenta: cta };
        });
    }

    // ── Eliminar un abono de flete ──────────────────────────────────────────
    async eliminarAbonoTx(idAbono: number): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeFlete(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de flete', 400);
            }
            const idCxp = Number(abono.id_cuenta_pagar);

            if (abono.metodo_pago === 'saldo_a_favor' && abono.id_saldo_favor) {
                await this.repo.aplicarACredito(Number(abono.id_saldo_favor), -r2(Number(abono.valor)), conn);
            }
            const safGen = await this.repo.saldoAFavorPorAbono(idAbono, conn);
            if (safGen) {
                if (Number(safGen.monto_aplicado) > 0) {
                    throw err('El sobrepago de este abono ya se usó; revierte primero ese descuento', 409);
                }
                await this.repo.eliminarSaldoAFavor(Number(safGen.id), conn);
            }

            await this.repo.eliminarAbono(idAbono, conn);
            await this.repo.recalcularCuenta(idCxp, conn);
            await this.aplicarEfectoFlete(idCxp, conn);
            return await this.repo.obtenerCuenta(idCxp, conn);
        });
    }

    // Todos los abonos de flete (todas las cuentas), paginado de a 50 por defecto.
    async listarAbonosPaginado(filtros: { id_dueno_volqueta?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<any> {
        const page = Math.max(1, Number(filtros.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(filtros.limit) || 50));
        const { rows, total } = await this.repo.listarAbonosPaginado({ ...filtros, page, limit });
        return { abonos: rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 } };
    }

    // Helper transaccional.
    private async tx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const out = await fn(conn);
            await conn.commit();
            return out;
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }
}
