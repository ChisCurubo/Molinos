import { PoolConnection } from 'mysql2/promise';
import { CategoriaProducto, ProductoSQL } from '../../../models/inventario_productos/sql/producto.sql';
import { MovimientoInventarioSQL, TipoMovimientoInventario } from '../../../models/inventario_productos/sql/movimiento.sql';

export interface ProductoConStock extends ProductoSQL {
    stock_actual: number;
    costo_promedio: string;
    valor_stock: string;
}

export interface IProductoRepository {
    create(data: { nombre: string; categoria: CategoriaProducto; unidad: string; stock_minimo?: number }): Promise<number>;
    getById(id: number): Promise<ProductoConStock | null>;
    update(id: number, data: Partial<{ nombre: string; categoria: CategoriaProducto; unidad: string; stock_minimo: number }>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(filtros: { categoria?: string; q?: string; bajo_minimo?: boolean; limit?: number; offset?: number }): Promise<ProductoConStock[]>;
}

export interface IMovimientoRepository {
    // Devuelve el último movimiento (mayor id) de un producto, bloqueando la fila del producto para serializar concurrencia.
    getUltimoYLockProducto(conn: PoolConnection, id_producto: number): Promise<{ saldo_cantidad: number; saldo_valor: number } | null>;
    insert(conn: PoolConnection, data: { id_producto: number; fecha: string; tipo: TipoMovimientoInventario; cantidad: number; costo_unitario: number; nota: string | null; costo_total: number; saldo_cantidad: number; saldo_valor: number }): Promise<number>;
    getById(id: number): Promise<MovimientoInventarioSQL | null>;
    deleteYObtenerPosteriores(conn: PoolConnection, id: number): Promise<{ id_producto: number; posteriores: MovimientoInventarioSQL[]; saldoBase: { saldo_cantidad: number; saldo_valor: number } } | null>;
    actualizarResueltos(conn: PoolConnection, id: number, data: { costo_unitario: number; costo_total: number; saldo_cantidad: number; saldo_valor: number }): Promise<void>;
    list(filtros: { id_producto?: number; tipo?: TipoMovimientoInventario; desde?: string; hasta?: string; limit?: number; offset?: number }): Promise<MovimientoInventarioSQL[]>;
    sumaCostoEntradas(filtros: { desde?: string; hasta?: string }): Promise<number>;
}
