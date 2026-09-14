import { CategoriaProveedorSQL } from '../../../models/pagos/sql/categoria_proveedor.sql';
import { ProveedorSQL } from '../../../models/pagos/sql/proveedor.sql';

// --- Original: categoria_proveedor ---
export interface ICategoriaProveedorRepository {
    create(data: Omit<CategoriaProveedorSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<CategoriaProveedorSQL | null>;
    update(id: number, data: Partial<CategoriaProveedorSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaProveedorSQL[]>;
}

// --- Proveedores (la entidad real: transportadoras de mula, laboratorios, gasolineras, etc.) ---
export interface IProveedorRepository {
    create(data: { nombre: string; id_categoria?: number; contacto?: string; telefono?: string; ciudad?: string; alias?: string; nequi?: boolean; compra_realizada?: string; estado?: string }): Promise<number>;
    getById(id: number): Promise<any | null>;
    update(id: number, data: Partial<ProveedorSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(filtros: { id_categoria?: number; estado?: string; q?: string }): Promise<any[]>;
}