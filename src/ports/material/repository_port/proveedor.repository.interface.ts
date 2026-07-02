import { ProveedorSQL } from '../../models/pagos/sql/proveedor.sql';

export interface IProveedorRepository {
    create(data: Omit<ProveedorSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<ProveedorSQL | null>;
    update(id: number, data: Partial<ProveedorSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ProveedorSQL[]>;
}
