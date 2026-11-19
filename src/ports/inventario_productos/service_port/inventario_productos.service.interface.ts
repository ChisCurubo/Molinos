import { ProductoConStock } from '../repository_port/inventario_productos.repository.interface';
import { MovimientoInventarioSQL } from '../../../models/inventario_productos/sql/movimiento.sql';

export interface IProductoService {
    create(data: any): Promise<ProductoConStock>;
    getById(id: number): Promise<ProductoConStock | null>;
    update(id: number, data: any): Promise<ProductoConStock | null>;
    delete(id: number): Promise<boolean>;
    list(filtros: any): Promise<ProductoConStock[]>;
}

export interface IMovimientoService {
    create(data: any): Promise<MovimientoInventarioSQL>;
    delete(id: number): Promise<boolean>;
    list(filtros: any): Promise<MovimientoInventarioSQL[]>;
}

export interface IResumenInventarioService {
    resumen(filtros: { desde?: string; hasta?: string }): Promise<{
        total_productos: number;
        valor_total_inventario: string;
        productos_bajo_minimo: number;
        gastado_en_compras: string;
    }>;
}
