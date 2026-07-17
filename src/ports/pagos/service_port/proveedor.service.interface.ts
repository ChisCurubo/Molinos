import { CategoriaProveedorSQL } from '../../../models/pagos/sql/categoria_proveedor.sql';

// --- Original: categoria_proveedor ---
export interface ICategoriaProveedorService {
    create(data: any): Promise<CategoriaProveedorSQL>;
    getById(id: number): Promise<CategoriaProveedorSQL | null>;
    update(id: number, data: any): Promise<CategoriaProveedorSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaProveedorSQL[]>;
}