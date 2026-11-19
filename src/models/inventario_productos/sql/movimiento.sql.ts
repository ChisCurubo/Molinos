// Automáticamente generado a partir de migracion_inventario_productos_2026-11-02.sql

export type TipoMovimientoInventario = 'entrada' | 'salida';

export interface MovimientoInventarioSQL {
    id: number;
    id_producto: number;
    fecha: Date;
    tipo: TipoMovimientoInventario;
    cantidad: number;
    costo_unitario: number | null;
    nota: string | null;
    costo_total: number;
    saldo_cantidad: number;
    saldo_valor: number;
    created_at: Date;
}
