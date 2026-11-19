import { PoolConnection } from 'mysql2/promise';
import { CategoriaCxcSQL } from '../../../models/pagos/sql/categoria_cxc.sql';

// --- Original: categoria_cxc ---
export interface ICategoriaCxCRepository {
    create(data: Omit<CategoriaCxcSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<CategoriaCxcSQL | null>;
    update(id: number, data: Partial<CategoriaCxcSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaCxcSQL[]>;
}

export interface FiltrosCxCPaginado {
    mes?: number;
    anio?: number;
    id_categoria?: number;
    estado?: string;
    page: number;
    limit: number;
}

export interface CrearCxCData {
    id_categoria: number;
    concepto: string;
    valor_total: number;
    id_empleado?: number;
    id_minero?: number;
    id_dueno_volqueta?: number;
    id_proveedor?: number;
    fecha_creacion: string;
    fecha_limite?: string;
}

export interface AbonoCxCData {
    valor: number;
    fecha_cobro: string;
    metodo?: string;
    comprobante_url: string;
    observaciones?: string;
}

export interface EditarCxCData {
    concepto?: string;
    id_categoria?: number;
    valor_total?: number;
    fecha_creacion?: string;
    fecha_limite?: string;
    deudor?: { id_empleado: number | null; id_minero: number | null; id_dueno_volqueta: number | null; id_proveedor: number | null };
}

// Cuentas_Por_Cobrar: la tabla existe en el esquema (espejo de Cuentas_Por_Pagar). Se puede
// crear sin abono (deuda pendiente de cobrar después) o con un abono inicial en el mismo
// paso (cobro inmediato) — decisión 2026-10-22.
export interface ICuentasPorCobrarRepository {
    listarPaginado(filtros: FiltrosCxCPaginado): Promise<{ rows: any[]; total: number }>;
    crear(data: CrearCxCData, conn?: PoolConnection): Promise<number>;
    crearAbono(idCxc: number, data: AbonoCxCData, conn?: PoolConnection): Promise<number>;
    recalcularCuenta(idCxc: number, conn?: PoolConnection): Promise<void>;
    obtenerPorId(id: number): Promise<any | null>;
    editar(id: number, cambios: EditarCxCData): Promise<void>;
    anular(id: number): Promise<boolean>;
}