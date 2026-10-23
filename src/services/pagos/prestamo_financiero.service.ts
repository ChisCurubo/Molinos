import { Pool, PoolConnection } from 'mysql2/promise';
import { PrestamoFinancieroSQL } from '../../models/pagos/sql/prestamo_financiero.sql';
import { MovimientoPrestamoFinancieroSQL } from '../../models/pagos/sql/movimiento_prestamo_financiero.sql';
import { IPrestamoFinancieroRepository } from '../../ports/pagos/repository_port/prestamo_financiero.repository.interface';
import { IPrestamoFinancieroService, ProyeccionInteres } from '../../ports/pagos/service_port/prestamo_financiero.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const hoy = () => new Date().toISOString().slice(0, 10);

/** Meses completos entre dos fechas (ej. 15-ene → 15-feb = 1; 14-feb = 0). */
function mesesCompletosEntre(desde: Date, hasta: Date): number {
    let meses = (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth());
    if (hasta.getDate() < desde.getDate()) meses -= 1;
    return Math.max(0, meses);
}

export class PrestamoFinancieroService implements IPrestamoFinancieroService {
    constructor(private repository: IPrestamoFinancieroRepository, private db: Pool) {}

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

    /**
     * Un préstamo bancario desembolsado es dinero real de tesorería que entra a la
     * empresa (distinto de Deposito, caja menor de planta) — se registra también como
     * Ingresos_Tesoreria en la misma transacción. Ver EMPLEADOS_PRESTAMOS_plan.md Fase 2.
     *
     * También abre la CxP persistente de la deuda (categoría 'Préstamo financiero',
     * 'pendiente' por monto_principal) — decisión 2026-10-23, para que el préstamo sí
     * aparezca como deuda real en /pagos/cxp/mensual mientras no se termine de pagar.
     */
    async create(data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL> {
        if (!data.monto_principal || Number(data.monto_principal) <= 0) {
            throw err('monto_principal debe ser mayor a 0');
        }
        const fecha = data.fecha_adquisicion ? new Date(data.fecha_adquisicion) : new Date();
        const fechaSql = fecha.toISOString().slice(0, 10);
        const nombre = (data.nombre_prestamo || '').trim();

        return this.tx(async conn => {
            const id = await this.repository.create({ ...data, fecha_adquisicion: fecha, saldo_pendiente: data.saldo_pendiente ?? data.monto_principal }, conn);
            await this.repository.crearIngresoTesoreria(
                { concepto: `Desembolso préstamo ${nombre}`.trim(), valor: Number(data.monto_principal), fecha: fechaSql, id_prestamo_fin: id }, conn
            );
            await this.repository.crearCxPInicial(
                { id_prestamo_fin: id, concepto: `Préstamo ${nombre}`.trim(), valor_total: Number(data.monto_principal), fecha: fechaSql }, conn
            );
            const entity = await this.repository.getById(id, conn);
            if (!entity) throw new Error("Error registrando el préstamo financiero");
            return entity;
        });
    }

    async getById(id: number): Promise<PrestamoFinancieroSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL | null> {
        const success = await this.repository.update(id, data);
        if (!success) return null;
        return this.repository.getById(id);
    }

    /**
     * DELETE solo válido si fue un error de captura (sin abonos/ajustes). Como el
     * desembolso también generó su Ingresos_Tesoreria espejo (Fase 2) y su CxP persistente
     * (2026-10-23), ambos se borran en la misma transacción — no son movimientos aparte, son
     * la misma captura.
     */
    async delete(id: number): Promise<boolean> {
        const existe = await this.repository.getById(id);
        if (!existe) throw err('Préstamo financiero no encontrado', 404);
        if (Number(existe.saldo_pendiente) !== Number(existe.monto_principal)) {
            throw err('Este préstamo ya tiene abonos o ajustes registrados y no se puede eliminar', 409);
        }
        return this.tx(async conn => {
            await this.repository.eliminarIngresoTesoreria(id, conn);
            await this.repository.eliminarCxP(id, conn);
            return this.repository.delete(id, conn);
        });
    }

    async list(): Promise<PrestamoFinancieroSQL[]> {
        return this.repository.list();
    }

    /** Fecha desde la que se cuenta el próximo período de interés: el último movimiento, o la fecha de adquisición si nunca se ha acumulado nada. */
    private async fechaBaseInteres(prestamo: PrestamoFinancieroSQL): Promise<Date> {
        const ultimo = await this.repository.ultimoMovimiento(prestamo.id);
        return ultimo ? new Date(ultimo.fecha) : new Date(prestamo.fecha_adquisicion);
    }

    async proyectarInteres(id: number, fecha?: string): Promise<ProyeccionInteres> {
        const prestamo = await this.repository.getById(id);
        if (!prestamo) throw err('Préstamo financiero no encontrado', 404);
        const fechaCorte = fecha ? new Date(fecha) : new Date();
        const fechaBase = await this.fechaBaseInteres(prestamo);
        const meses = mesesCompletosEntre(fechaBase, fechaCorte);
        const saldo_actual = Number(prestamo.saldo_pendiente);
        const interes_proyectado = r2(saldo_actual * (Number(prestamo.tasa_interes) / 100) * meses);
        return {
            id_prestamo_fin: id,
            saldo_actual,
            meses_a_acumular: meses,
            interes_proyectado,
            saldo_si_se_acumula: r2(saldo_actual + interes_proyectado)
        };
    }

    /**
     * Capitaliza el interés del período transcurrido desde el último movimiento (tasa_interes
     * es mensual, ver comentario de columna en Prestamos_Financieros). No es un movimiento de
     * caja — no toca Tesorería. Sí sube valor_total de la CxP persistente del préstamo (2026-10-23),
     * para que su saldo (valor_total-valor_pagado) siga igual a saldo_pendiente.
     */
    async acumularInteres(id: number, fecha?: string): Promise<MovimientoPrestamoFinancieroSQL> {
        const prestamo = await this.repository.getById(id);
        if (!prestamo) throw err('Préstamo financiero no encontrado', 404);
        if (!prestamo.activo) throw err('El préstamo ya está cancelado/inactivo', 409);

        const fechaCorte = fecha ? new Date(fecha) : new Date();
        const fechaBase = await this.fechaBaseInteres(prestamo);
        const meses = mesesCompletosEntre(fechaBase, fechaCorte);
        if (meses <= 0) throw err('Aún no ha pasado un mes completo desde el último movimiento de este préstamo', 409);

        const saldoActual = Number(prestamo.saldo_pendiente);
        const interes = r2(saldoActual * (Number(prestamo.tasa_interes) / 100) * meses);
        const nuevoSaldo = r2(saldoActual + interes);
        const fechaStr = fechaCorte.toISOString().slice(0, 10);

        return this.tx(async conn => {
            const cxp = await this.repository.obtenerCxP(id, conn);
            if (!cxp) throw new Error('No se encontró la CxP persistente de este préstamo (dato inconsistente)');
            await this.repository.actualizarSaldo(id, nuevoSaldo, true, conn);
            await this.repository.aumentarValorTotalCxP(cxp.id, interes, conn);
            const idMov = await this.repository.insertarMovimiento({
                id_prestamo_fin: id, tipo: 'interes', fecha: fechaStr, valor: interes,
                saldo_resultante: nuevoSaldo, id_abono_cxp: null,
                observaciones: `Interés de ${meses} mes(es) sobre saldo ${saldoActual}`
            }, conn);
            return (await this.repository.obtenerMovimiento(idMov, conn))!;
        });
    }

    /**
     * Registra un abono real al préstamo: paga sobre la CxP persistente del préstamo
     * (categoría 'Préstamo financiero', la misma desde que se creó — 2026-10-23, antes abría
     * una CxP nueva ya pagada cada vez), reduce saldo_pendiente y deja el movimiento en el historial.
     */
    async abonar(id: number, data: { valor: number; fecha_abono?: string; metodo_pago?: string; comprobante_url?: string; observaciones?: string }): Promise<MovimientoPrestamoFinancieroSQL> {
        const valor = Number(data.valor);
        if (!valor || valor <= 0) throw err('valor debe ser mayor a 0');

        const prestamo = await this.repository.getById(id);
        if (!prestamo) throw err('Préstamo financiero no encontrado', 404);
        if (!prestamo.activo) throw err('El préstamo ya está cancelado/inactivo', 409);

        const saldoActual = Number(prestamo.saldo_pendiente);
        if (valor > saldoActual) throw err(`El abono (${valor}) no puede superar el saldo pendiente (${saldoActual})`, 409);

        const fecha = data.fecha_abono || hoy();
        const nuevoSaldo = r2(saldoActual - valor);

        return this.tx(async conn => {
            const cxp = await this.repository.obtenerCxP(id, conn);
            if (!cxp) throw new Error('No se encontró la CxP persistente de este préstamo (dato inconsistente)');
            const id_abono = await this.repository.registrarAbono(cxp.id, {
                fecha_abono: fecha, valor, metodo_pago: data.metodo_pago,
                comprobante_url: data.comprobante_url, observaciones: data.observaciones
            }, conn);
            await this.repository.actualizarSaldo(id, nuevoSaldo, nuevoSaldo > 0, conn);
            const idMov = await this.repository.insertarMovimiento({
                id_prestamo_fin: id, tipo: 'abono', fecha, valor, saldo_resultante: nuevoSaldo,
                id_abono_cxp: id_abono, observaciones: data.observaciones ?? null
            }, conn);
            return (await this.repository.obtenerMovimiento(idMov, conn))!;
        });
    }

    async listarMovimientos(id: number): Promise<MovimientoPrestamoFinancieroSQL[]> {
        const prestamo = await this.repository.getById(id);
        if (!prestamo) throw err('Préstamo financiero no encontrado', 404);
        return this.repository.listarMovimientos(id);
    }
}
