import { ICategoriaProveedorService, IProveedorService } from '../../ports/pagos/service_port/proveedor.service.interface';
import { ICategoriaProveedorRepository, IProveedorRepository } from '../../ports/pagos/repository_port/proveedor.repository.interface';
import { CategoriaProveedorRepository } from '../../repositories/pagos/proveedor.repository';
import { CategoriaProveedorSQL } from '../../models/pagos/sql/categoria_proveedor.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };

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

// --- Proveedores (la entidad real) ---
export class ProveedorService implements IProveedorService {
    constructor(private repository: IProveedorRepository) {}

    async create(data: any): Promise<any> {
        const nombre = (data.nombre ?? '').toString().trim();
        if (!nombre) throw err('nombre es requerido');
        const id = await this.repository.create({
            nombre,
            id_categoria: data.id_categoria ? Number(data.id_categoria) : undefined,
            contacto: data.contacto, telefono: data.telefono, ciudad: data.ciudad,
            alias: data.alias, nequi: data.nequi, compra_realizada: data.compra_realizada,
            estado: data.estado
        });
        return this.repository.getById(id);
    }

    async getById(id: number): Promise<any | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<any | null> {
        const existe = await this.repository.getById(id);
        if (!existe) throw err('Proveedor no encontrado', 404);
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        try {
            return await this.repository.delete(id);
        } catch (e: any) {
            if (e?.errno === 1451) {
                throw err('Este proveedor tiene registros asociados (pagos, mulas, análisis, etc.) y no se puede eliminar', 409);
            }
            throw e;
        }
    }

    async list(filtros: { id_categoria?: number; estado?: string; q?: string }): Promise<any[]> {
        return this.repository.list(filtros);
    }
}