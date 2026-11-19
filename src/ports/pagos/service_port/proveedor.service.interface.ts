import { CategoriaProveedorSQL } from '../../../models/pagos/sql/categoria_proveedor.sql';

// --- Original: categoria_proveedor ---
export interface ICategoriaProveedorService {
    create(data: any): Promise<CategoriaProveedorSQL>;
    getById(id: number): Promise<CategoriaProveedorSQL | null>;
    update(id: number, data: any): Promise<CategoriaProveedorSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaProveedorSQL[]>;
}

// --- Proveedores (la entidad real) ---
export interface IProveedorService {
    create(data: any): Promise<any>;
    getById(id: number): Promise<any | null>;
    update(id: number, data: any): Promise<any | null>;
    delete(id: number): Promise<boolean>;
    list(filtros: { id_categoria?: number; tipo?: string; estado?: string; q?: string }): Promise<any[]>;
}