import { Pool } from 'mysql2/promise';
import { ICategoriaCxCService, ICuentasPorCobrarService } from '../../ports/pagos/service_port/cxc.service.interface';
import { ICategoriaCxCRepository, ICuentasPorCobrarRepository } from '../../ports/pagos/repository_port/cxc.repository.interface';
import { CategoriaCxCRepository } from '../../repositories/pagos/cxc.repository';
import { CategoriaCxcSQL } from '../../models/pagos/sql/categoria_cxc.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const hoy = () => new Date().toISOString().slice(0, 10);
const CAMPOS_DEUDOR = ['id_empleado', 'id_minero', 'id_dueno_volqueta', 'id_proveedor'];

// --- Original: categoria_cxc ---
export class CategoriaCxCService implements ICategoriaCxCService {
    constructor(private repository: ICategoriaCxCRepository) {}

    async create(data: any): Promise<CategoriaCxcSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<CategoriaCxcSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<CategoriaCxcSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<CategoriaCxcSQL[]> {
        return this.repository.list();
    }
}

// --- Cuentas_Por_Cobrar ---
export class CuentasPorCobrarService implements ICuentasPorCobrarService {
    constructor(private repo: ICuentasPorCobrarRepository, private db: Pool) {}

    // Mes a mes, 50 por página (tope), filtrable por categoría/estado.
    async listarPaginado(filtros: { mes?: number; anio?: number; id_categoria?: number; estado?: string; page?: number; limit?: number }): Promise<any> {
        const page = Math.max(1, Number(filtros.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(filtros.limit) || 50));
        const { rows, total } = await this.repo.listarPaginado({ ...filtros, page, limit });
        return { cuentas: rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 } };
    }

    // Crea la deuda sin abono (para cobrarla después) o, si viene `abono`, la crea ya
    // cobrada (total o parcialmente) en el mismo paso — decisión 2026-10-22.
    async crear(data: any): Promise<any> {
        const concepto = (data.concepto || '').trim();
        if (!concepto) throw err('El concepto es obligatorio');
        if (!data.id_categoria) throw err('id_categoria es obligatorio');
        const valorTotal = r2(Number(data.valor_total));
        if (!(valorTotal > 0)) throw err('valor_total debe ser mayor a 0');
        if (CAMPOS_DEUDOR.filter(k => data[k] != null).length > 1) {
            throw err(`Solo puede haber un deudor (${CAMPOS_DEUDOR.join('/')})`);
        }

        let abono: { valor: number; fecha_cobro: string; metodo?: string; comprobante_url: string; observaciones?: string } | null = null;
        if (data.abono) {
            const valorAbono = r2(Number(data.abono.valor));
            if (!(valorAbono > 0)) throw err('El valor del abono debe ser mayor a 0');
            if (!data.abono.comprobante_url) throw err('comprobante_url del abono es obligatorio');
            if (valorAbono > valorTotal + 1e-6) throw err('El abono inicial no puede superar el valor_total', 409);
            abono = { ...data.abono, valor: valorAbono, fecha_cobro: data.abono.fecha_cobro || hoy() };
        }

        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const idCxc = await this.repo.crear({
                id_categoria: data.id_categoria, concepto, valor_total: valorTotal,
                id_empleado: data.id_empleado, id_minero: data.id_minero,
                id_dueno_volqueta: data.id_dueno_volqueta, id_proveedor: data.id_proveedor,
                fecha_creacion: data.fecha_creacion || hoy(), fecha_limite: data.fecha_limite
            }, conn);
            if (abono) {
                await this.repo.crearAbono(idCxc, abono, conn);
                await this.repo.recalcularCuenta(idCxc, conn);
            }
            await conn.commit();
            return this.repo.obtenerPorId(idCxc);
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    async obtenerPorId(id: number): Promise<any> {
        const row = await this.repo.obtenerPorId(id);
        if (!row) throw err('Cuenta por cobrar no encontrada', 404);
        return row;
    }

    // Registra un cobro sobre una CxC que ya existe (la que se creó sin abono).
    async abonar(idCxc: number, data: any): Promise<any> {
        const valor = r2(Number(data.valor));
        if (!(valor > 0)) throw err('El valor del abono debe ser mayor a 0');
        if (!data.comprobante_url) throw err('comprobante_url es obligatorio');

        const cuenta = await this.repo.obtenerPorId(idCxc);
        if (!cuenta) throw err('Cuenta por cobrar no encontrada', 404);
        if (cuenta.estado === 'anulado') throw err('La cuenta está anulada', 409);
        const saldo = r2(Number(cuenta.valor_total) - Number(cuenta.valor_cobrado));
        if (valor > saldo + 1e-6) throw err(`El abono (${valor}) supera el saldo pendiente (${saldo})`, 409);

        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            await this.repo.crearAbono(idCxc, {
                valor, fecha_cobro: data.fecha_cobro || hoy(), metodo: data.metodo,
                comprobante_url: data.comprobante_url, observaciones: data.observaciones
            }, conn);
            await this.repo.recalcularCuenta(idCxc, conn);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
        return this.repo.obtenerPorId(idCxc);
    }

    async editar(id: number, data: any): Promise<any> {
        const actual = await this.repo.obtenerPorId(id);
        if (!actual) throw err('Cuenta por cobrar no encontrada', 404);
        if (actual.estado === 'anulado') throw err('No se puede editar una cuenta anulada', 409);

        const cambios: any = {};
        if (data.concepto !== undefined) {
            const concepto = (data.concepto || '').trim();
            if (!concepto) throw err('El concepto no puede quedar vacío');
            cambios.concepto = concepto;
        }
        if (data.id_categoria !== undefined) {
            if (!data.id_categoria) throw err('id_categoria no puede quedar vacío');
            cambios.id_categoria = data.id_categoria;
        }
        if (data.valor_total !== undefined) {
            const valorTotal = r2(Number(data.valor_total));
            if (!(valorTotal > 0)) throw err('valor_total debe ser mayor a 0');
            if (valorTotal < Number(actual.valor_cobrado) - 1e-6) {
                throw err(`valor_total (${valorTotal}) no puede ser menor a lo ya cobrado (${actual.valor_cobrado})`, 409);
            }
            cambios.valor_total = valorTotal;
        }
        if (data.fecha_creacion !== undefined) cambios.fecha_creacion = data.fecha_creacion;
        if (data.fecha_limite !== undefined) cambios.fecha_limite = data.fecha_limite;

        if (CAMPOS_DEUDOR.some(k => data[k] !== undefined)) {
            if (CAMPOS_DEUDOR.filter(k => data[k] != null).length > 1) {
                throw err(`Solo puede haber un deudor (${CAMPOS_DEUDOR.join('/')})`);
            }
            cambios.deudor = {};
            CAMPOS_DEUDOR.forEach(k => { cambios.deudor[k] = data[k] ?? null; });
        }

        if (Object.keys(cambios).length === 0) throw err('No hay cambios para aplicar');

        await this.repo.editar(id, cambios);
        return this.repo.obtenerPorId(id);
    }

    async anular(id: number): Promise<void> {
        const ok = await this.repo.anular(id);
        if (!ok) throw err('Cuenta por cobrar no encontrada o ya anulada', 404);
    }
}