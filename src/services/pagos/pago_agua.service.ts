import { Pool, PoolConnection } from 'mysql2/promise';
import { IPagoAguaRepository } from '../../ports/pagos/repository_port/pago_agua.repository.interface';
import { IPagoAguaService } from '../../ports/pagos/service_port/pago_agua.service.interface';

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
const estadoRegistroDesdeCuenta = (estadoCuenta: string): string =>
    estadoCuenta === 'anulado' ? 'pendiente' : estadoCuenta;

/**
 * Pago de AGUA al dueño de camión cisterna. Mismo motor que flete: CxP por (dueño, mes) categoría
 * 'Agua', abono en cascada del mes más viejo al más nuevo. Valor de cada registro = NETO per-registro
 * = max(0, bruto − ACPM de Combustible por id_agua). Trazabilidad: cada Relacion queda atada a su
 * id_agua con su ACPM propio visible. Efecto: al abonar se actualiza agua_planta.estado_pago.
 * Los 2 "positivos de gasolina": credito_gasolina (ACPM adelantado de más por registro) y
 * credito_sobrepago (Saldo_A_Favor por abonar de más).
 */
export class PagoAguaService implements IPagoAguaService {
    constructor(private repo: IPagoAguaRepository, private db: Pool) {}

    // ── Materialización: arma las cuentas mensuales con los registros aún sin cuenta ──
    private async materializar(idDueno: number, conn: PoolConnection): Promise<void> {
        const registros = await this.repo.aguasPayablesDelDueno(idDueno, conn);
        const yaEn = new Set(await this.repo.idsAguaConRelacion(idDueno, conn));

        const cuentaCache = new Map<string, number>();
        const cuentasTocadas = new Set<number>();

        for (const reg of registros) {
            const idAgua = Number(reg.id_agua);
            if (yaEn.has(idAgua)) continue;

            const neto = r2(Number(reg.neto));
            if (neto <= 0) {
                // Registro saldado por completo con ACPM adelantado → nada que pagar.
                await this.repo.actualizarEstadoAguaRegistros([idAgua], 'pagado', conn);
                continue;
            }

            const { anio, mes } = anioMes(reg.fecha);
            const key = `${anio}-${mes}`;
            let idCxp = cuentaCache.get(key);
            if (!idCxp) {
                idCxp = (await this.repo.buscarCuentaMesAgua(idDueno, anio, mes, conn)) ?? undefined as any;
                if (!idCxp) {
                    const mm = String(mes).padStart(2, '0');
                    idCxp = await this.repo.crearCuentaAgua({
                        id_dueno_volqueta: idDueno,
                        concepto: `Agua ${anio}-${mm}`,
                        valor_total: 0,
                        fecha_creacion: `${anio}-${mm}-01`
                    }, conn);
                }
                cuentaCache.set(key, idCxp);
            }
            await this.repo.crearRelacionAgua(idCxp, idAgua, neto, `Agua ${String(reg.fecha).slice(0, 10)}`, conn);
            await this.repo.sumarValorTotal(idCxp, neto, conn);
            cuentasTocadas.add(idCxp);
        }

        for (const idCxp of cuentasTocadas) {
            await this.repo.recalcularCuenta(idCxp, conn);
            await this.aplicarEfectoAgua(idCxp, conn);
        }
    }

    // Propaga el estado de la cuenta a cada registro de agua (agua_planta.estado_pago).
    private async aplicarEfectoAgua(idCxp: number, conn: PoolConnection): Promise<void> {
        const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
        if (!cuenta) return;
        const estado = estadoRegistroDesdeCuenta(cuenta.estado);
        const ids = await this.repo.idsAguaDeCuenta(idCxp, conn);
        await this.repo.actualizarEstadoAguaRegistros(ids, estado, conn);
    }

    // Neto total + positivo de gasolina (per-registro) de un dueño, desde los registros.
    private async netoYGasolina(idDueno: number): Promise<{ bruto: number; acpm: number; neto: number; credito_gasolina: number; }> {
        const registros = await this.repo.aguasPayablesDelDueno(idDueno);
        let bruto = 0, acpm = 0, neto = 0, gas = 0;
        for (const reg of registros) {
            const b = Number(reg.bruto) || 0, a = Number(reg.acpm) || 0;
            bruto += b; acpm += a; neto += Number(reg.neto) || 0;
            gas += Math.max(0, a - b);   // ACPM adelantado de más en ese registro
        }
        return { bruto: r2(bruto), acpm: r2(acpm), neto: r2(neto), credito_gasolina: r2(gas) };
    }

    // ── Dashboard: cuánto le debo a cada dueño (con los 2 positivos de gasolina) ──
    async deudaPorDueno(): Promise<any[]> {
        const [duenos, abonadoMap] = await Promise.all([
            this.repo.duenosConAgua(),
            this.repo.abonadoAguaPorDueno()
        ]);
        const out: any[] = [];
        for (const d of duenos) {
            const t = await this.netoYGasolina(Number(d.id));
            const abonado = Number(abonadoMap.get(Number(d.id)) || 0);
            const saldo = r2(t.neto - abonado);
            const creditoSobrepago = await this.repo.sumaCreditoDisponibleDueno(Number(d.id));
            out.push({
                id: d.id, nombre: d.nombre, alias: d.alias,
                banco: d.banco, numero_cuenta: d.numero_cuenta, nequi: d.nequi,
                bruto_total: t.bruto, acpm_total: t.acpm, neto_total: t.neto,
                abonado, saldo_pendiente: saldo < 0 ? 0 : saldo,
                credito_gasolina: t.credito_gasolina,
                credito_sobrepago: r2(creditoSobrepago)
            });
        }
        return out.filter(x => x.saldo_pendiente > 0 || x.credito_gasolina > 0 || x.credito_sobrepago > 0)
                  .sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
    }

    // ── Estado de cuenta de un dueño (meses + registros + abonos) ────────────
    async estadoCuentaDueno(idDueno: number, filtros: { mes?: number; anio?: number } = {}): Promise<any> {
        await this.tx(async conn => { await this.materializar(idDueno, conn); });

        const cuentas = await this.repo.cuentasDelDueno(idDueno, filtros.anio, filtros.mes);
        const meses = [];
        for (const c of cuentas) {
            const [registros, abonos] = await Promise.all([
                this.repo.relacionesConProrrateo(c.id),
                this.repo.listarAbonos(c.id)
            ]);
            meses.push({
                id_cuenta: c.id, concepto: c.concepto, periodo: periodoDe(c.fecha_creacion),
                valor_total: c.valor_total, valor_pagado: c.valor_pagado, saldo: c.saldo, estado: c.estado,
                num_registros: registros.length, registros, abonos
            });
        }

        const t = await this.netoYGasolina(idDueno);
        const totalPagado = meses.reduce((s, m) => s + Number(m.valor_pagado), 0);
        const totalSaldo = meses.reduce((s, m) => s + Number(m.saldo), 0);
        const creditoSobrepago = await this.repo.sumaCreditoDisponibleDueno(idDueno);

        return {
            id_dueno: idDueno,
            resumen: {
                bruto_total: t.bruto, acpm_total: t.acpm, neto_total: t.neto,
                total_pagado: r2(totalPagado), saldo_pendiente: r2(totalSaldo),
                credito_gasolina: t.credito_gasolina,
                credito_sobrepago: r2(creditoSobrepago)
            },
            meses
        };
    }

    // ── Abonar en cascada ────────────────────────────────────────────────────
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
                await this.aplicarEfectoAgua(c.id, conn);
                const cuenta = await this.repo.obtenerCuenta(c.id, conn);
                aplicado.push({ id_cuenta: c.id, periodo: periodoDe(c.fecha_creacion), aplicado: monto, estado: cuenta.estado });
                restante = r2(restante - monto);
            }

            if (aplicado.length === 0) {
                throw err('El dueño no tiene deuda de agua pendiente; no hay a qué aplicar el abono', 409);
            }

            let saldoAFavor = 0;
            if (restante > 0) {
                await this.repo.crearSaldoAFavorDueno({
                    id_abono_cxp_orig: ultimoAbono,
                    id_dueno_volqueta: idDueno,
                    monto_original: restante,
                    descripcion: `Sobrepago de agua (abono #${ultimoAbono})`
                }, conn);
                saldoAFavor = restante;
            }

            return { aplicado_a: aplicado, total_aplicado: r2(valor - saldoAFavor), saldo_a_favor_generado: saldoAFavor };
        });
    }

    // ── Editar un abono de agua ──────────────────────────────────────────────
    async actualizarAbonoTx(idAbono: number, data: any): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeAgua(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de agua', 400);
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
            await this.aplicarEfectoAgua(idCxp, conn);
            const ab = await this.repo.obtenerAbono(idAbono, conn);
            const cta = await this.repo.obtenerCuenta(idCxp, conn);
            return { abono: ab, cuenta: cta };
        });
    }

    // ── Eliminar un abono de agua ────────────────────────────────────────────
    async eliminarAbonoTx(idAbono: number): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeAgua(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de agua', 400);
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
            await this.aplicarEfectoAgua(idCxp, conn);
            return await this.repo.obtenerCuenta(idCxp, conn);
        });
    }

    // Todos los abonos de agua (todas las cuentas), paginado de a 50 por defecto.
    async listarAbonosPaginado(filtros: { id_dueno_volqueta?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<any> {
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
