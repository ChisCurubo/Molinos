// Automáticamente generado a partir de migracion_inventario_productos_2026-11-02.sql

export type CategoriaProducto = 'quimico' | 'bola_molino' | 'filtro_prensa' | 'repuesto' | 'consumible' | 'otro';

export interface ProductoSQL {
    id: number;
    nombre: string;
    categoria: CategoriaProducto;
    unidad: string;
    stock_minimo: number;
    created_at: Date;
    updated_at: Date;
}
