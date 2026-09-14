import { Pool, PoolConnection } from 'mysql2/promise';
import { IPagoMulaRepository } from '../../ports/pagos/repository_port/pago_mula.repository.interface';
import { IPagoMulaService } from '../../ports/pagos/service_port/pago_mula.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pago de MULAS (despachos de concentrado a Barranquilla). 1 Mula = 1 CxP categoría 'Mula'
 * (beneficiario = proveedor transportador) por el NETO de retención (`retencion_mula_pct`).
 *
 * Al registrar una Mula solo se captura la DEUDA (`valor` = lo que se debe pagar); no se pide
 * comprobante ni un "valor pagado" ahí — eso vive en los abonos. Los abonos se registran por
 * PROVEEDOR y se aplican en cascada (despacho más viejo primero) sobre todas sus cuentas de mula
 * abiertas — mismo mecanismo que pago_flete/pago_agua. Si un abono paga de más, el excedente
 * genera automáticamente un Saldo_A_Favor del proveedor (no se bloquea, no se pierde).
 *
 * El Viaje vinculado (`id_viaje`) pasa a 'despachado' al registrar la mula (el material sale
 * físicamente ese día, sin importar cuándo se termine de pagar) — ver Viaje.estado.
 */
export class PagoMulaService implements IPagoMulaService {
    constructor(private repo: IPagoMulaRepository, private db: Pool) {}

    async crearMulaTx(data: any): Promise<any> {
        const idProveedor = Number(data.id_proveedor);
        if (!idProveedor) throw err('id_proveedor es requerido');
        const valor = r2(Number(data.valor));
        if (!(valor > 0)) throw err('El valor de la mula (lo que se debe pagar) debe ser mayor a 0');
        const fecha = data.fecha || new Date().toISOString().slice(0, 10);
        const concepto = (data.concepto && String(data.concepto).trim())
            || `Mula${data.factura_num ? ' factura ' + data.factura_num : ''} — despacho ${fecha}`;
        const idViaje = data.id_viaje ? Number(data.id_viaje) : undefined;

        return this.tx(async conn => {
            if (idViaje) {
                const estadoViaje = await this.repo.obtenerEstadoViaje(idViaje, conn);
                if (!estadoViaje) throw err('El viaje indicado no existe', 404);
                if (estadoViaje === 'despachado') throw err('Este viaje ya fue despachado en otra mula', 409);
            }

            const idMula = await this.repo.crearMula({
                id_proveedor: idProveedor, id_viaje: idViaje, fecha,
                concepto: data.concepto, factura_num: data.factura_num,
                foto_factura_url: data.foto_factura_url, valor
            }, conn);

            // El material sale físicamente al registrar el despacho, sin importar si ya se pagó.
            if (idViaje) await this.repo.marcarEstadoViaje(idViaje, 'despachado', conn);

            const pct = await this.repo.pctRetencionMula(conn);
            const neto = r2(valor - valor * pct / 100);
            const idCxp = await this.repo.crearCuentaMula({
                id_proveedor: idProveedor, concepto, valor_total: neto, fecha_creacion: fecha
            }, conn);
            await this.repo.crearRelacionMula(idCxp, idMula, neto, concepto, conn);

            return await this.repo.obtenerMula(idMula, conn);
        });
    }

    async listarMulas(filtros: { id_proveedor?: number; id_viaje?: number; estado?: string }): Promise<any[]> {
        return this.repo.listarMulas(filtros);
    }

    // KPIs del período: cuántos despachos, cuánto se debe/retuvo/pagó/queda pendiente.
    async resumenMulas(filtros: { desde?: string; hasta?: string; id_proveedor?: number }): Promise<any> {
        const r = await this.repo.resumenMulas(filtros);
        return {
            total_despachos: Number(r.total_despachos) || 0,
            valor_adeudado_total: r.valor_adeudado_total,
            retencion_total: r.retencion_total,
            abono_neto_total: r.abono_neto_total,
            total_pagado: r.total_pagado,
            total_pendiente: r.total_pendiente
        };
    }

    async obtenerMulaDetalle(id: number): Promise<any> {
        const mula = await this.repo.obtenerMula(id);
        if (!mula) throw err('Mula no encontrada', 404);
        const idCxp = await this.repo.cuentaDeMula(id);
        const cuenta = idCxp ? await this.repo.obtenerCuenta(idCxp) : null;
        const abonos = idCxp ? await this.repo.listarAbonos(idCxp) : [];
        return { ...mula, cuenta, abonos };
    }

    // Editar el despacho. Si cambia `valor` (la deuda), se recalcula el neto de la CxP.
    async actualizarMulaTx(id: number, data: any): Promise<any> {
        return this.tx(async conn => {
            const mula = await this.repo.obtenerMula(id, conn);
            if (!mula) throw err('Mula no encontrada', 404);

            const camposMula: any = {};
            for (const k of ['id_viaje', 'fecha', 'concepto', 'factura_num', 'foto_factura_url']) {
                if (data[k] !== undefined) camposMula[k] = data[k];
            }

            // Cambio de viaje vinculado: valida el nuevo, marca despachado/almacenado en cascada.
            if (data.id_viaje !== undefined) {
                const viajeAnterior = mula.id_viaje ? Number(mula.id_viaje) : null;
                const viajeNuevo = data.id_viaje === null ? null : Number(data.id_viaje);
                if (viajeNuevo !== viajeAnterior) {
                    if (viajeNuevo) {
                        const estadoNuevo = await this.repo.obtenerEstadoViaje(viajeNuevo, conn);
                        if (!estadoNuevo) throw err('El viaje indicado no existe', 404);
                        if (estadoNuevo === 'despachado') throw err('Este viaje ya fue despachado en otra mula', 409);
                        await this.repo.marcarEstadoViaje(viajeNuevo, 'despachado', conn);
                    }
                    if (viajeAnterior) await this.repo.marcarEstadoViaje(viajeAnterior, 'almacenado', conn);
                }
            }

            let nuevoValor: number | undefined;
            if (data.valor !== undefined) {
                nuevoValor = r2(Number(data.valor));
                if (!(nuevoValor > 0)) throw err('El valor de la mula debe ser mayor a 0');
                camposMula.valor = nuevoValor;
            }

            if (Object.keys(camposMula).length > 0) {
                await this.repo.actualizarMula(id, camposMula, conn);
            }

            if (nuevoValor !== undefined) {
                const idCxp = await this.repo.cuentaDeMula(id, conn);
                if (idCxp) {
                    const pct = await this.repo.pctRetencionMula(conn);
                    const neto = r2(nuevoValor - nuevoValor * pct / 100);
                    await this.repo.ajustarValorTotalCuenta(idCxp, neto, conn);
                    await this.repo.recalcularCuenta(idCxp, conn);
                }
            }

            return await this.repo.obtenerMula(id, conn);
        });
    }

    // Elimina el despacho completo (CxP + relación + mula). Solo si no tiene abonos registrados.
    async eliminarMulaTx(id: number): Promise<void> {
        return this.tx(async conn => {
            const mula = await this.repo.obtenerMula(id, conn);
            if (!mula) throw err('Mula no encontrada', 404);
            const idCxp = await this.repo.cuentaDeMula(id, conn);
            if (idCxp) {
                const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
                if (cuenta && Number(cuenta.valor_pagado) > 0) {
                    throw err('Esta mula ya tiene abonos registrados; elimínelos antes de eliminarla', 409);
                }
                await this.repo.eliminarRelacionMula(id, conn);
                await this.repo.anularCuenta(idCxp, conn);
            }
            if (mula.id_viaje) await this.repo.marcarEstadoViaje(Number(mula.id_viaje), 'almacenado', conn);
            await this.repo.eliminarMula(id, conn);
        });
    }

    // ── Abonar en cascada a un proveedor (despacho más viejo primero) ───────
    async registrarAbonoProveedorTx(idProveedor: number, data: any): Promise<any> {
        const valor = r2(Number(data.valor));
        if (!(valor > 0)) throw err('El valor del abono debe ser mayor a 0');
        const comprobante = (data.comprobante_url ?? '').toString().trim();
        if (!comprobante) throw err('Cada abono requiere el comprobante (comprobante_url)');
        const fecha = data.fecha_abono || new Date().toISOString().slice(0, 10);

        return this.tx(async conn => {
            const cuentas = await this.repo.cuentasAbiertasDelProveedor(idProveedor, conn);

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
                aplicado.push({
                    id_cuenta: c.id, id_mula: c.id_mula, id_viaje: c.id_viaje,
                    aplicado: monto, estado: cuenta.estado
                });
                restante = r2(restante - monto);
            }

            if (aplicado.length === 0) {
                throw err('El proveedor no tiene deuda de mulas pendiente; no hay a qué aplicar el abono', 409);
            }

            let saldoAFavor = 0;
            if (restante > 0) {
                await this.repo.crearSaldoAFavorProveedor({
                    id_abono_cxp_orig: ultimoAbono ?? undefined,
                    id_proveedor: idProveedor,
                    monto_original: restante,
                    descripcion: `Sobrepago de mulas (abono #${ultimoAbono})`
                }, conn);
                saldoAFavor = restante;
            }

            return { aplicado_a: aplicado, total_aplicado: r2(valor - saldoAFavor), saldo_a_favor_generado: saldoAFavor };
        });
    }

    async actualizarAbonoTx(idAbono: number, data: any): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeMula(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de mula', 400);
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
            const [ab, cta] = await Promise.all([
                this.repo.obtenerAbono(idAbono, conn),
                this.repo.obtenerCuenta(idCxp, conn)
            ]);
            return { abono: ab, cuenta: cta };
        });
    }

    async eliminarAbonoTx(idAbono: number): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeMula(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de mula', 400);
            }
            const idCxp = Number(abono.id_cuenta_pagar);

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

    async listarAbonosPaginado(filtros: { id_proveedor?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<any> {
        const page = Math.max(1, Number(filtros.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(filtros.limit) || 50));
        const { rows, total } = await this.repo.listarAbonosPaginado({ ...filtros, page, limit });
        return { abonos: rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 } };
    }

    // Por viaje: qué proveedor lo despachó y qué abonos se le han hecho a esa mula.
    async trazabilidadPorViaje(): Promise<any[]> {
        const filas = await this.repo.trazabilidadPorViaje();
        const out: any[] = [];
        for (const f of filas) {
            const abonos = f.id_cuenta_pagar ? await this.repo.listarAbonos(f.id_cuenta_pagar) : [];
            out.push({ ...f, abonos });
        }
        return out;
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
