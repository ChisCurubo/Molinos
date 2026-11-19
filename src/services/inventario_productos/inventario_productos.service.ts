import Database from '../../config/database.config';
import { IProductoRepository, IMovimientoRepository, ProductoConStock } from '../../ports/inventario_productos/repository_port/inventario_productos.repository.interface';
import { IProductoService, IMovimientoService, IResumenInventarioService } from '../../ports/inventario_productos/service_port/inventario_productos.service.interface';
import { MovimientoInventarioSQL } from '../../models/inventario_productos/sql/movimiento.sql';
import { AppError } from '../../errors/app-error';

const err = (msg: string, status = 400, code?: string): AppError => AppError.http(status, msg, code ?? (status === 400 ? 'BUSINESS_RULE' : undefined));

const CATEGORIAS = ['quimico', 'bola_molino', 'filtro_prensa', 'repuesto', 'consumible', 'otro'];
const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export class ProductoService implements IProductoService {
    constructor(private repository: IProductoRepository) {}

    async create(data: any): Promise<ProductoConStock> {
        const nombre = (data.nombre ?? '').toString().trim();
        if (!nombre) throw err('nombre es requerido');
        const categoria = data.categoria ?? 'otro';
        if (!CATEGORIAS.includes(categoria)) throw err(`categoria inválida, debe ser una de: ${CATEGORIAS.join(', ')}`);
        const unidad = (data.unidad ?? '').toString().trim();
        if (!unidad) throw err('unidad es requerida');
        const id = await this.repository.create({ nombre, categoria, unidad, stock_minimo: data.stock_minimo !== undefined ? Number(data.stock_minimo) : undefined });
        return (await this.repository.getById(id))!;
    }

    async getById(id: number): Promise<ProductoConStock | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<ProductoConStock | null> {
        const existe = await this.repository.getById(id);
        if (!existe) throw err('Producto no encontrado', 404);
        if (data.categoria !== undefined && !CATEGORIAS.includes(data.categoria)) {
            throw err(`categoria inválida, debe ser una de: ${CATEGORIAS.join(', ')}`);
        }
        await this.repository.update(id, {
            nombre: data.nombre, categoria: data.categoria, unidad: data.unidad,
            stock_minimo: data.stock_minimo !== undefined ? Number(data.stock_minimo) : undefined
        });
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(filtros: { categoria?: string; q?: string; bajo_minimo?: string | boolean; limit?: string | number; offset?: string | number }): Promise<ProductoConStock[]> {
        return this.repository.list({
            categoria: filtros.categoria,
            q: filtros.q,
            bajo_minimo: filtros.bajo_minimo === true || filtros.bajo_minimo === 'true',
            limit: filtros.limit !== undefined ? Number(filtros.limit) : undefined,
            offset: filtros.offset !== undefined ? Number(filtros.offset) : undefined
        });
    }
}

export class MovimientoService implements IMovimientoService {
    constructor(private repository: IMovimientoRepository, private productoRepository: IProductoRepository) {}

    async create(data: any): Promise<MovimientoInventarioSQL> {
        const id_producto = Number(data.id_producto);
        if (!id_producto) throw err('id_producto es requerido');
        const fecha = (data.fecha ?? '').toString().slice(0, 10);
        if (!fecha) throw err('fecha es requerida');
        const tipo = data.tipo;
        if (tipo !== 'entrada' && tipo !== 'salida') throw err(`tipo inválido, debe ser 'entrada' o 'salida'`);
        const cantidad = Number(data.cantidad);
        if (!cantidad || cantidad <= 0) throw err('cantidad debe ser un número mayor a 0');
        if (tipo === 'entrada' && (data.costo_unitario === undefined || data.costo_unitario === null || Number(data.costo_unitario) <= 0)) {
            throw err('costo_unitario es requerido y mayor a 0 en una entrada');
        }
        const nota = data.nota ?? null;

        const id = await Database.withTransaction(async (conn) => {
            const saldo = await this.repository.getUltimoYLockProducto(conn, id_producto);
            if (!saldo) throw err('Producto no encontrado', 404);

            let costo_unitario: number, costo_total: number, saldo_cantidad: number, saldo_valor: number;
            if (tipo === 'entrada') {
                costo_unitario = round4(Number(data.costo_unitario));
                costo_total = round2(cantidad * costo_unitario);
                saldo_cantidad = round4(saldo.saldo_cantidad + cantidad);
                saldo_valor = round2(saldo.saldo_valor + costo_total);
            } else {
                if (cantidad > saldo.saldo_cantidad) throw err('Stock insuficiente', 400, 'STOCK_INSUFICIENTE');
                costo_unitario = saldo.saldo_cantidad > 0 ? round4(saldo.saldo_valor / saldo.saldo_cantidad) : 0;
                costo_total = round2(cantidad * costo_unitario);
                saldo_cantidad = round4(saldo.saldo_cantidad - cantidad);
                saldo_valor = round2(saldo.saldo_valor - costo_total);
            }

            return this.repository.insert(conn, { id_producto, fecha, tipo, cantidad, costo_unitario, nota, costo_total, saldo_cantidad, saldo_valor });
        });

        return (await this.repository.getById(id))!;
    }

    async delete(id: number): Promise<boolean> {
        await Database.withTransaction(async (conn) => {
            const resultado = await this.repository.deleteYObtenerPosteriores(conn, id);
            if (!resultado) throw err('Movimiento no encontrado', 404);

            let { saldo_cantidad, saldo_valor } = resultado.saldoBase;
            for (const mov of resultado.posteriores) {
                const cantidad = Number(mov.cantidad);
                let costo_unitario: number, costo_total: number;
                if (mov.tipo === 'entrada') {
                    costo_unitario = Number(mov.costo_unitario);
                    costo_total = round2(cantidad * costo_unitario);
                    saldo_cantidad = round4(saldo_cantidad + cantidad);
                    saldo_valor = round2(saldo_valor + costo_total);
                } else {
                    costo_unitario = saldo_cantidad > 0 ? round4(saldo_valor / saldo_cantidad) : 0;
                    costo_total = round2(cantidad * costo_unitario);
                    saldo_cantidad = round4(saldo_cantidad - cantidad);
                    saldo_valor = round2(saldo_valor - costo_total);
                }
                await this.repository.actualizarResueltos(conn, mov.id, { costo_unitario, costo_total, saldo_cantidad, saldo_valor });
            }
        });
        return true;
    }

    async list(filtros: { id_producto?: string | number; tipo?: string; desde?: string; hasta?: string; limit?: string | number; offset?: string | number }): Promise<MovimientoInventarioSQL[]> {
        return this.repository.list({
            id_producto: filtros.id_producto !== undefined ? Number(filtros.id_producto) : undefined,
            tipo: filtros.tipo as any,
            desde: filtros.desde,
            hasta: filtros.hasta,
            limit: filtros.limit !== undefined ? Number(filtros.limit) : undefined,
            offset: filtros.offset !== undefined ? Number(filtros.offset) : undefined
        });
    }
}

export class ResumenInventarioService implements IResumenInventarioService {
    constructor(private productoRepository: IProductoRepository, private movimientoRepository: IMovimientoRepository) {}

    async resumen(filtros: { desde?: string; hasta?: string }): Promise<{ total_productos: number; valor_total_inventario: string; productos_bajo_minimo: number; gastado_en_compras: string }> {
        const productos = await this.productoRepository.list({});
        const valor_total_inventario = productos.reduce((acc, p) => acc + Number(p.valor_stock), 0);
        const productos_bajo_minimo = productos.filter(p => p.stock_actual < Number(p.stock_minimo)).length;
        const gastado_en_compras = await this.movimientoRepository.sumaCostoEntradas(filtros);
        return {
            total_productos: productos.length,
            valor_total_inventario: round2(valor_total_inventario).toFixed(2),
            productos_bajo_minimo,
            gastado_en_compras: round2(gastado_en_compras).toFixed(2)
        };
    }
}
