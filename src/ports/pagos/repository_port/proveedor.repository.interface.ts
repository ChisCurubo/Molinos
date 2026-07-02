import { CategoriaProveedorSQL } from '../../models/pagos/sql/categoria_proveedor.sql';

// --- Original: categoria_proveedor ---
export interface ICategoriaProveedorRepository {
    create(data: Omit<CategoriaProveedorSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<CategoriaProveedorSQL | null>;
    update(id: number, data: Partial<CategoriaProveedorSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaProveedorSQL[]>;
}