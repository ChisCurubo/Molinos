import { Pool, PoolConnection } from 'mysql2/promise';
import { IContratoAlquilerRepository } from '../../ports/pagos/repository_port/contrato_alquiler.repository.interface';
import { IContratoAlquilerService } from '../../ports/pagos/service_port/contrato_alquiler.service.interface';
import { ContratoAlquilerSQL } from '../../models/pagos/sql/contrato_alquiler.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function toYMD(d: Date): string { return d.toISOString().slice(0, 10); }
function diasDelMes(anio: number, mesIndex0: number): number { return new Date(anio, mesIndex0 + 1, 0).getDate(); }

// Genera una fecha por mes desde fecha_inicio hasta fecha_fin (inclusive), conservando el
// día-de-mes de fecha_inicio y recortando al último día cuando el mes no lo tiene (ej. 31 → 28/29/30).
function generarFechasMensuales(fechaInicio: Date, fechaFin: Date): Date[] {
    const diaAncla = fechaInicio.getUTCDate();
    const fechas: Date[] = [];
    let anio = fechaInicio.getUTCFullYear();
    let mes = fechaInicio.getUTCMonth();

    while (true) {
        const dia = Math.min(diaAncla, diasDelMes(anio, mes));
        const candidata = new Date(Date.UTC(anio, mes, dia));
        if (candidata > fechaFin) break;
        fechas.push(candidata);
        mes += 1;
        if (mes > 11) { mes = 0; anio += 1; }
    }
    return fechas;
}

/**
 * Contrato de arriendo de larga duración (ej. 1 año). Al crearse, genera automáticamente
 * un Alquileres por cada mes del período — cada uno se paga individualmente con el motor
 * de pago que ya existe (PagoAlquilerService). El contrato en sí es solo el paraguas +
 * el link al documento firmado; no se paga directamente.
 */
export class ContratoAlquilerService implements IContratoAlquilerService {
    constructor(
        private repo: IContratoAlquilerRepository,
        private db: Pool
    ) {}

    async create(data: any): Promise<{ contrato: ContratoAlquilerSQL; meses: any[] }> {
        if (!data.id_proveedor) throw err('id_proveedor es obligatorio');
        if (!data.concepto) throw err('concepto es obligatorio');
        const valorMensual = Number(data.valor_mensual);
        if (!(valorMensual > 0)) throw err('valor_mensual debe ser mayor a 0');

        const fechaInicio = new Date(data.fecha_inicio);
        const fechaFin = new Date(data.fecha_fin);
        if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) throw err('fecha_inicio/fecha_fin inválidas');
        if (fechaFin < fechaInicio) throw err('fecha_fin no puede ser anterior a fecha_inicio');

        const fechas = generarFechasMensuales(fechaInicio, fechaFin);
        if (fechas.length === 0) throw err('El período no genera ningún mes de cobro');

        return this.tx(async conn => {
            const idContrato = await this.repo.create({
                id_tipo: data.id_tipo ?? null,
                id_proveedor: data.id_proveedor,
                concepto: data.concepto,
                valor_mensual: valorMensual,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                contrato_url: data.contrato_url ?? null
            } as any, conn);

            for (const fecha of fechas) {
                await this.repo.crearAlquilerMensual({
                    id_tipo: data.id_tipo ?? null,
                    id_proveedor: data.id_proveedor,
                    id_contrato: idContrato,
                    fecha_inicio: fecha as any,
                    concepto: `${data.concepto} - ${MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`,
                    valor: valorMensual
                } as any, conn);
            }

            const contrato = await this.repo.getById(idContrato, conn);
            const meses = await conn.query('SELECT * FROM Alquileres WHERE id_contrato = ? ORDER BY fecha_inicio ASC', [idContrato]);
            return { contrato: contrato!, meses: (meses[0] as any[]) };
        });
    }

    async getById(id: number): Promise<{ contrato: ContratoAlquilerSQL; meses: any[] } | null> {
        const contrato = await this.repo.getById(id);
        if (!contrato) return null;
        const meses = await this.repo.mesesDeContrato(id);
        return { contrato, meses };
    }

    // Solo edita metadata del contrato (concepto, valor_mensual de referencia, contrato_url,
    // fecha_fin). NO regenera ni toca los meses ya creados en Alquileres.
    async update(id: number, data: any): Promise<ContratoAlquilerSQL | null> {
        const permitido: any = {};
        if (data.concepto !== undefined) permitido.concepto = data.concepto;
        if (data.valor_mensual !== undefined) permitido.valor_mensual = data.valor_mensual;
        if (data.contrato_url !== undefined) permitido.contrato_url = data.contrato_url;
        if (data.fecha_fin !== undefined) permitido.fecha_fin = data.fecha_fin;
        if (data.id_tipo !== undefined) permitido.id_tipo = data.id_tipo;

        await this.repo.update(id, permitido);
        return this.repo.getById(id);
    }

    // Anula el contrato (borrado lógico). Los meses ya generados en Alquileres quedan
    // intactos — se anulan uno por uno con DELETE /pagos/alquileres/:id si corresponde.
    async delete(id: number): Promise<boolean> {
        return this.repo.delete(id);
    }

    async list(): Promise<ContratoAlquilerSQL[]> {
        return this.repo.list();
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
