import { PoolConnection } from 'mysql2/promise';
import { CategoriaIngresoSQL, IngresoTesoreriaSQL } from '../../../models/pagos/sql/ingreso_tesoreria.sql';

export interface FiltrosIngresoTesoreria {
    id_categoria?: number;
    desde?: string;
    hasta?: string;
}

export interface IIngresoTesoreriaRepository {
    crear(data: { id_categoria: number; concepto: string; valor: number; fecha: string; id_prestamo_fin?: number | null; comprobante_url?: string }, conn?: PoolConnection): Promise<number>;
    obtenerPorId(id: number): Promise<any | null>;
    listar(filtros: FiltrosIngresoTesoreria): Promise<any[]>;
    actualizar(id: number, data: Partial<IngresoTesoreriaSQL>): Promise<boolean>;
    eliminar(id: number): Promise<boolean>;
    resolverCategoriaPorNombre(nombre: string, conn?: PoolConnection): Promise<number>;
    listarCategorias(): Promise<CategoriaIngresoSQL[]>;
}
