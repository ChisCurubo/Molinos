import { Pool, PoolConnection } from 'mysql2/promise';
import { IAnticipoRepository, TerceroAnticipo } from '../../ports/pagos/repository_port/anticipo.repository.interface';
import { IAnticipoService } from '../../ports/pagos/service_port/anticipo.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const TERCEROS_VALIDOS: TerceroAnticipo[] = ['minero', 'dueno_volqueta', 'proveedor'];
const NOMBRE_TERCERO: Record<TerceroAnticipo, string> = {
    minero: 'minero', dueno_volqueta: 'dueño de volqueta', proveedor: 'proveedor'
};

/**
 * Anticipos a terceros (minero/dueño de volqueta/proveedor): la empresa adelanta dinero
 * y lo descuenta de pagos futuros. Decisiones cerradas — ver ANTICIPOS_plan.md §4:
 *  1) el descuento futuro usa metodo_pago='saldo_a_favor' (no un ENUM nuevo).
 *  2) Historial_Descuentos_Anticipos generalizado (id_entrada nullable + id_abono_cxp).
 *  3) el egreso al crear el anticipo se paga de inmediato como una CxP normal.
 *  4) no se reutiliza Cuentas_Por_Cobrar (esa es plata que la empresa cobra, no que adelanta).
 *
 * Al crear, además del registro de negocio (Anticipos_Terceros) se genera un espejo en
 * Saldo_A_Favor (origen='anticipo') — ese espejo es el crédito que realmente se consume
 * después en la cascada de abonos de material/flete/agua (fuera de este módulo por ahora).
 */
export class AnticipoService implements IAnticipoService {
    constructor(private repo: IAnticipoRepository, private db: Pool) {}

    private validarTercero(tercero: string): TerceroAnticipo {
        if (!TERCEROS_VALIDOS.includes(tercero as TerceroAnticipo)) {
            throw err(`tercero debe ser uno de: ${TERCEROS_VALIDOS.join(', ')}`);
        }
        return tercero as TerceroAnticipo;
    }

    async crearAnticipoTx(data: any): Promise<any> {
        const tercero = this.validarTercero(data.tercero);
        const idTercero = Number(data.id);
        if (!idTercero) throw err('id del tercero es requerido');
        const monto = r2(Number(data.monto));
        if (!(monto > 0)) throw err('El monto del anticipo debe ser mayor a 0');
        const comprobante = (data.comprobante_url ?? '').toString().trim();
        if (!comprobante) throw err('El anticipo requiere el comprobante (comprobante_url) del desembolso');
        const fecha = data.fecha || new Date().toISOString().slice(0, 10);
        const concepto = (data.descripcion && String(data.descripcion).trim())
            || `Anticipo a ${NOMBRE_TERCERO[tercero]} #${idTercero}`;

        return this.tx(async conn => {
            const idAnticipo = await this.repo.crearAnticipo(
                { tercero, id: idTercero, fecha, monto, descripcion: data.descripcion }, conn
            );
            const idCxp = await this.repo.crearCuentaAnticipo(
                { tercero, id: idTercero, concepto, valor_total: monto, fecha_creacion: fecha }, conn
            );
            await this.repo.crearRelacionAnticipo(idCxp, idAnticipo, monto, concepto, conn);
            await this.repo.insertarAbono({
                id_cuenta_pagar: idCxp, fecha_abono: fecha, valor: monto,
                metodo_pago: data.metodo_pago || 'efectivo',
                comprobante_url: comprobante, observaciones: data.observaciones
            }, conn);
            await this.repo.recalcularCuenta(idCxp, conn);
            await this.repo.crearSaldoAFavorAnticipo({
                id_anticipo: idAnticipo, tercero, id: idTercero, id_cuenta_pagar: idCxp,
                monto_original: monto, descripcion: `Anticipo #${idAnticipo}`
            }, conn);

            return await this.repo.obtenerAnticipo(idAnticipo, conn);
        });
    }

    async listarAnticipos(filtros: { tercero?: string; id?: number; estado?: string }): Promise<any[]> {
        const tercero = filtros.tercero ? this.validarTercero(filtros.tercero) : undefined;
        return this.repo.listarAnticipos({ tercero, id: filtros.id, estado: filtros.estado });
    }

    async obtenerAnticipoDetalle(id: number): Promise<any> {
        const anticipo = await this.repo.obtenerAnticipo(id);
        if (!anticipo) throw err('Anticipo no encontrado', 404);
        const historial = await this.repo.historialDescuentos(id);
        return { ...anticipo, historial };
    }

    async anularAnticipoTx(id: number): Promise<any> {
        return this.tx(async conn => {
            const anticipo = await this.repo.obtenerAnticipo(id, conn);
            if (!anticipo) throw err('Anticipo no encontrado', 404);
            if (anticipo.estado === 'anulado') throw err('El anticipo ya está anulado', 409);
            if (Number(anticipo.monto_usado) > 0) {
                throw err('El anticipo ya fue usado en un pago; no se puede anular', 409);
            }
            const saf = await this.repo.saldoAFavorDeAnticipo(id, conn);
            if (saf && Number(saf.monto_aplicado) > 0) {
                throw err('El crédito de este anticipo ya fue usado; no se puede anular', 409);
            }
            if (saf) await this.repo.eliminarSaldoAFavor(Number(saf.id), conn);

            const idCxp = await this.repo.cuentaDeAnticipo(id, conn);
            if (idCxp) await this.repo.anularCuenta(idCxp, conn);

            await this.repo.anularAnticipo(id, conn);
            return await this.repo.obtenerAnticipo(id, conn);
        });
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
