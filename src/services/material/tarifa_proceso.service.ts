import { Pool } from 'mysql2/promise';
import { ITarifaProcesoRepository, ITarifaProcesoService } from '../../ports/material/tarifa_proceso.interface';

export class TarifaProcesoService implements ITarifaProcesoService {
    constructor(private repo: ITarifaProcesoRepository, private db: Pool) {}

    private hoy(): string {
        return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    }

    async listar(filtros: { codigo?: string; activo?: number }): Promise<any[]> {
        return await this.repo.listar(filtros);
    }

    async obtenerVigentes(fecha?: string): Promise<any[]> {
        return await this.repo.obtenerVigentes(fecha || this.hoy());
    }

    /**
     * Crea una NUEVA vigencia de tarifa para un código (versionado por fechas):
     *  1. Cierra la(s) vigencia(s) abierta(s) del código (fecha_hasta = día previo, activo = 0).
     *  2. Inserta la nueva fila (fecha_hasta = NULL, activo = 1).
     * El cálculo de maquila de un lote toma la tarifa vigente en su fecha, así que los
     * lotes históricos conservan el precio que tenían y los nuevos usan el nuevo.
     */
    async crearNuevaVigencia(data: any): Promise<any> {
        const codigo = (data.codigo || '').trim();
        if (!codigo) throw new Error('El código de la tarifa es obligatorio');
        const valor = Number(data.valor);
        if (!Number.isFinite(valor) || valor < 0) throw new Error('El valor de la tarifa debe ser un número >= 0');
        const fecha_desde = data.fecha_desde || this.hoy();

        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            await this.repo.cerrarVigenciasAbiertas(codigo, fecha_desde, conn);
            const id = await this.repo.crear({
                codigo,
                descripcion: data.descripcion,
                valor,
                unidad: data.unidad,
                fecha_desde,
                fecha_hasta: null,
                activo: 1
            }, conn);
            const creada = await this.repo.obtenerPorId(id, conn);
            await conn.commit();
            return creada;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async actualizar(id: number, data: any): Promise<any> {
        const existe = await this.repo.obtenerPorId(id);
        if (!existe) { const e: any = new Error('Tarifa no encontrada'); e.status = 404; throw e; }
        if (data.valor !== undefined) {
            const v = Number(data.valor);
            if (!Number.isFinite(v) || v < 0) throw new Error('El valor de la tarifa debe ser un número >= 0');
        }
        await this.repo.actualizar(id, data);
        return await this.repo.obtenerPorId(id);
    }
}
