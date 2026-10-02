import { Pool, PoolConnection } from 'mysql2/promise';
import { IPagoCombustibleRepository } from '../../ports/pagos/repository_port/pago_combustible.repository.interface';
import { IPagoCombustibleService } from '../../ports/pagos/service_port/pago_combustible.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

function anioMes(fecha: any): { anio: number; mes: number } {
    const s = typeof fecha === 'string' ? fecha : new Date(fecha).toISOString();
    const [y, m] = s.slice(0, 10).split('-').map(Number);
    return { anio: y, mes: m };
}
function periodoDe(fecha: any): string {
    if (fecha instanceof Date) return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    return String(fecha).slice(0, 7);
}

/**
 * Pago de COMBUSTIBLE a la gasolinera. Se agrupa por (gasolinera, mes) en Cuentas_Por_Pagar
 * y se abona en cascada del mes más viejo al más nuevo. El valor de cada consumo es su
 * `valor` directo (sin neteo — a diferencia de Flete/Agua, aquí no hay ACPM que restar:
 * estos registros YA SON el ACPM/consumo, cargado a crédito de la gasolinera).
 * Solo entran a este flujo los registros de Combustible con forma_pago='credito'.
 */
export class PagoCombustibleService implements IPagoCombustibleService {
    constructor(
        private repo: IPagoCombustibleRepository,
        private db: Pool
    ) {}

    // ── Materialización: arma las cuentas mensuales con los consumos aún sin cuenta ──
    private async materializar(idGasolinera: number, conn: PoolConnection): Promise<void> {
        const yaEn = new Set(await this.repo.idsCombustibleConRelacion(idGasolinera, conn));
        const consumos = await this.repo.consumosCreditoDeGasolinera(idGasolinera, conn);

        const cuentaCache = new Map<string, number>();
        const cuentasTocadas = new Set<number>();

        for (const c of consumos) {
            if (yaEn.has(c.id_combustible)) continue;

            const monto = r2(Number(c.valor));
            if (monto <= 0) continue;

            const { anio, mes } = anioMes(c.fecha);
            const key = `${anio}-${mes}`;
            let idCxp = cuentaCache.get(key);
            if (!idCxp) {
                idCxp = (await this.repo.buscarCuentaMesCombustible(idGasolinera, anio, mes, conn)) ?? undefined as any;
                if (!idCxp) {
                    const mm = String(mes).padStart(2, '0');
                    idCxp = await this.repo.crearCuentaCombustible({
                        id_gasolinera: idGasolinera,
                        concepto: `Combustible ${anio}-${mm}`,
                        valor_total: 0,
                        fecha_creacion: `${anio}-${mm}-01`
                    }, conn);
                }
                cuentaCache.set(key, idCxp);
            }
            await this.repo.crearRelacionCombustible(idCxp, c.id_combustible, monto, c.descripcion || `Consumo ${c.tipo_consumo}`, conn);
            await this.repo.sumarValorTotal(idCxp, monto, conn);
            cuentasTocadas.add(idCxp);
        }

        for (const idCxp of cuentasTocadas) {
            await this.repo.recalcularCuenta(idCxp, conn);
        }
    }

    // ── Dashboard: cuánto le debo a cada gasolinera ──────────────────────────
    async deudaPorGasolinera(): Promise<any[]> {
        const [gasolineras, abonadoMap] = await Promise.all([
            this.repo.gasolinerasConCredito(),
            this.repo.abonadoCombustiblePorGasolinera()
        ]);
        const out: any[] = [];
        for (const g of gasolineras) {
            const totalCredito = await this.repo.totalCreditoPorGasolinera(Number(g.id));
            const abonado = Number(abonadoMap.get(Number(g.id)) || 0);
            const saldo = r2(totalCredito - abonado);
            const creditoSobrepago = await this.repo.sumaCreditoDisponibleProveedor(Number(g.id));
            out.push({
                id: g.id, nombre: g.nombre, alias: g.alias,
                total_credito: r2(totalCredito),
                abonado,
                saldo_pendiente: saldo < 0 ? 0 : saldo,
                credito_sobrepago: r2(creditoSobrepago)
            });
        }
        return out.filter(x => x.saldo_pendiente > 0 || x.credito_sobrepago > 0)
                  .sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
    }

    // ── Estado de cuenta de una gasolinera (meses + consumos + abonos) ──────
    async estadoCuentaGasolinera(idGasolinera: number, filtros: { mes?: number; anio?: number } = {}): Promise<any> {
        await this.tx(async conn => { await this.materializar(idGasolinera, conn); });

        const cuentas = await this.repo.cuentasDeGasolinera(idGasolinera, filtros.anio, filtros.mes);
        const meses = [];
        for (const c of cuentas) {
            const [consumos, abonos] = await Promise.all([
                this.repo.relacionesDeCuenta(c.id),
                this.repo.listarAbonos(c.id)
            ]);
            meses.push({
                id_cuenta: c.id, concepto: c.concepto, periodo: periodoDe(c.fecha_creacion),
                valor_total: c.valor_total, valor_pagado: c.valor_pagado, saldo: c.saldo, estado: c.estado,
                num_consumos: consumos.length, consumos, abonos
            });
        }

        const totalCredito = await this.repo.totalCreditoPorGasolinera(idGasolinera);
        const totalPagado = meses.reduce((s, m) => s + Number(m.valor_pagado), 0);
        const totalSaldo = meses.reduce((s, m) => s + Number(m.saldo), 0);
        const creditoSobrepago = await this.repo.sumaCreditoDisponibleProveedor(idGasolinera);

        return {
            id_gasolinera: idGasolinera,
            resumen: {
                total_credito: r2(totalCredito),
                total_pagado: r2(totalPagado),
                saldo_pendiente: r2(totalSaldo),
                credito_sobrepago: r2(creditoSobrepago)
            },
            meses
        };
    }

    // ── Abonar en cascada (monto libre, comprobante obligatorio) ────────────
    async registrarAbonoGasolineraTx(idGasolinera: number, data: any): Promise<any> {
        const valor = r2(Number(data.valor));
        if (!(valor > 0)) throw err('El valor del abono debe ser mayor a 0');
        const comprobante = (data.comprobante_url ?? '').toString().trim();
        if (!comprobante) throw err('Cada abono requiere el comprobante (comprobante_url)');
        const fecha = data.fecha_abono || new Date().toISOString().slice(0, 10);

        return this.tx(async conn => {
            await this.materializar(idGasolinera, conn);
            const cuentas = await this.repo.cuentasAbiertasDeGasolinera(idGasolinera, conn);

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
                const cuenta = await this.repo.obtenerCuenta(c.id, conn);
                aplicado.push({ id_cuenta: c.id, periodo: periodoDe(c.fecha_creacion), aplicado: monto, estado: cuenta.estado });
                restante = r2(restante - monto);
            }

            if (aplicado.length === 0) {
                throw err('La gasolinera no tiene deuda de combustible pendiente; no hay a qué aplicar el abono', 409);
            }

            let saldoAFavor = 0;
            if (restante > 0) {
                await this.repo.crearSaldoAFavorProveedor({
                    id_abono_cxp_orig: ultimoAbono,
                    id_proveedor: idGasolinera,
                    monto_original: restante,
                    descripcion: `Sobrepago de combustible (abono #${ultimoAbono})`
                }, conn);
                saldoAFavor = restante;
            }

            return { aplicado_a: aplicado, total_aplicado: r2(valor - saldoAFavor), saldo_a_favor_generado: saldoAFavor };
        });
    }

    // ── Editar un abono de combustible ───────────────────────────────────────
    async actualizarAbonoTx(idAbono: number, data: any): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeCombustible(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de combustible', 400);
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
            const ab = await this.repo.obtenerAbono(idAbono, conn);
            const cta = await this.repo.obtenerCuenta(idCxp, conn);
            return { abono: ab, cuenta: cta };
        });
    }

    // ── Eliminar un abono de combustible ─────────────────────────────────────
    async eliminarAbonoTx(idAbono: number): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeCombustible(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de combustible', 400);
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
            return await this.repo.obtenerCuenta(idCxp, conn);
        });
    }

    // Todos los abonos de combustible (todas las cuentas), paginado de a 50 por defecto.
    async listarAbonosPaginado(filtros: { id_gasolinera?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<any> {
        const page = Math.max(1, Number(filtros.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(filtros.limit) || 50));
        const { rows, total } = await this.repo.listarAbonosPaginado({ ...filtros, page, limit });
        return { abonos: rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 } };
    }

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
