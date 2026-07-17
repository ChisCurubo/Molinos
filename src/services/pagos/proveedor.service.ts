import { ICategoriaProveedorService } from '../../ports/pagos/service_port/proveedor.service.interface';
import { ICategoriaProveedorRepository } from '../../ports/pagos/repository_port/proveedor.repository.interface';
import { CategoriaProveedorRepository } from '../../repositories/pagos/proveedor.repository';
import { CategoriaProveedorSQL } from '../../models/pagos/sql/categoria_proveedor.sql';

// --- Original: categoria_proveedor ---
export class CategoriaProveedorService implements ICategoriaProveedorService {
    constructor(private repository: ICategoriaProveedorRepository) {}

    async create(data: any): Promise<CategoriaProveedorSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<CategoriaProveedorSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<CategoriaProveedorSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<CategoriaProveedorSQL[]> {
        return this.repository.list();
    }
}