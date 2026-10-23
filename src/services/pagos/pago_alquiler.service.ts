import { Pool, PoolConnection } from 'mysql2/promise';
import { IPagoAlquilerRepository } from '../../ports/pagos/repository_port/pago_alquiler.repository.interface';
import { IPagoAlquilerService } from '../../ports/pagos/service_port/pago_alquiler.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pago de un ALQUILER a su proveedor. 1 Cuenta_Por_Pagar por alquiler (categoría 'Alquiler'),
 * creada perezosamente en el primer abono. Sin cascada entre alquileres ni saldo a favor:
 * el abono no puede exceder el saldo pendiente de ese alquiler.
 */
export class PagoAlquilerService implements IPagoAlquilerService {
    constructor(
        private repo: IPagoAlquilerRepository,
        private db: Pool
    ) {}

    // Asegura que el alquiler tiene su Cuenta_Por_Pagar (la crea si es el primer abono).
    private async asegurarCuenta(idAlquiler: number, conn: PoolConnection): Promise<number> {
        let idCxp = await this.repo.buscarCuentaDeAlquiler(idAlquiler, conn);
        if (idCxp) return idCxp;

        const alquiler = await this.repo.obtenerAlquiler(idAlquiler, conn);
        if (!alquiler) throw err('Alquiler no encontrado', 404);
        if (alquiler.deleted_at) throw err('El alquiler está anulado', 409);
        if (!alquiler.id_proveedor) throw err('El alquiler no tiene proveedor asignado; no se puede pagar', 409);

        idCxp = await this.repo.crearCuentaAlquiler({
            id_alquiler: idAlquiler,
            id_proveedor: alquiler.id_proveedor,
            concepto: alquiler.concepto,
            valor_total: Number(alquiler.valor),
            fecha_creacion: new Date(alquiler.fecha_inicio).toISOString().slice(0, 10)
        }, conn);
        await this.repo.crearRelacionAlquiler(idCxp, idAlquiler, Number(alquiler.valor), alquiler.concepto, conn);
        return idCxp;
    }

    // ── Estado de pago de un alquiler (crea la cuenta si todavía no existe) ──
    async estadoAlquiler(idAlquiler: number): Promise<any> {
        return this.tx(async conn => {
            const idCxp = await this.asegurarCuenta(idAlquiler, conn);
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            const abonos = await this.repo.listarAbonos(idCxp, conn);
            return {
                id_alquiler: idAlquiler, id_cuenta: idCxp,
                valor_total: cuenta.valor_total, valor_pagado: cuenta.valor_pagado,
                saldo: cuenta.saldo, estado: cuenta.estado, abonos
            };
        });
    }

    // ── Registrar abono (parcial o pago completo) ────────────────────────────
    async registrarAbonoTx(idAlquiler: number, data: any): Promise<any> {
        const valor = r2(Number(data.valor));
        if (!(valor > 0)) throw err('El valor del abono debe ser mayor a 0');
        const comprobante = (data.comprobante_url ?? '').toString().trim();
        if (!comprobante) throw err('Cada abono requiere el comprobante (comprobante_url)');
        const fecha = data.fecha_abono || new Date().toISOString().slice(0, 10);

        return this.tx(async conn => {
            const idCxp = await this.asegurarCuenta(idAlquiler, conn);
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (cuenta.estado === 'anulado') throw err('La cuenta de este alquiler está anulada', 409);
            const saldo = r2(Number(cuenta.valor_total) - Number(cuenta.valor_pagado));
            if (saldo <= 0) throw err('Este alquiler ya está pagado en su totalidad', 409);
            if (valor > saldo + 1e-6) throw err(`El abono (${valor}) excede el saldo pendiente (${saldo})`, 409);

            const idAbono = await this.repo.insertarAbono({
                id_cuenta_pagar: idCxp, fecha_abono: fecha, valor,
                metodo_pago: data.metodo_pago || 'transferencia',
                comprobante_url: comprobante, observaciones: data.observaciones
            }, conn);
            await this.repo.recalcularCuenta(idCxp, conn);
            const cuentaActualizada = await this.repo.obtenerCuenta(idCxp, conn);
            return { id_abono: idAbono, id_cuenta: idCxp, aplicado: valor, cuenta: cuentaActualizada };
        });
    }

    // ── Editar un abono de alquiler ───────────────────────────────────────
    async actualizarAbonoTx(idAbono: number, data: any): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeAlquiler(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de alquiler', 400);
            }
            const idCxp = Number(abono.id_cuenta_pagar);
            const cuenta = await this.repo.obtenerCuenta(idCxp, conn);
            if (!cuenta || cuenta.estado === 'anulado') throw err('La cuenta está anulada o no existe', 409);

            const campos: any = {};
            if (data.fecha_abono !== undefined) campos.fecha_abono = data.fecha_abono;
            if (data.metodo_pago !== undefined) campos.metodo_pago = data.metodo_pago;
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
                    throw err(`El abono deja el total pagado (${r2(nuevo + otros)}) por encima del valor del alquiler (${cuenta.valor_total})`, 409);
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

    // ── Eliminar un abono de alquiler ─────────────────────────────────────
    async eliminarAbonoTx(idAbono: number): Promise<any> {
        return this.tx(async conn => {
            const abono = await this.repo.obtenerAbono(idAbono, conn);
            if (!abono) throw err('Abono no encontrado', 404);
            if (!(await this.repo.esCuentaDeAlquiler(Number(abono.id_cuenta_pagar), conn))) {
                throw err('Este abono no es de una cuenta de alquiler', 400);
            }
            const idCxp = Number(abono.id_cuenta_pagar);
            await this.repo.eliminarAbono(idAbono, conn);
            await this.repo.recalcularCuenta(idCxp, conn);
            return await this.repo.obtenerCuenta(idCxp, conn);
        });
    }

    // Todos los abonos de alquiler, paginados de a 50 por defecto.
    async listarAbonosPaginado(filtros: { id_alquiler?: number; desde?: string; hasta?: string; metodo_pago?: string; page?: number; limit?: number }): Promise<any> {
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
