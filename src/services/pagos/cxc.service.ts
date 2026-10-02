import { ICategoriaCxCService, ICuentasPorCobrarService } from '../../ports/pagos/service_port/cxc.service.interface';
import { ICategoriaCxCRepository, ICuentasPorCobrarRepository } from '../../ports/pagos/repository_port/cxc.repository.interface';
import { CategoriaCxCRepository } from '../../repositories/pagos/cxc.repository';
import { CategoriaCxcSQL } from '../../models/pagos/sql/categoria_cxc.sql';

// --- Original: categoria_cxc ---
export class CategoriaCxCService implements ICategoriaCxCService {
    constructor(private repository: ICategoriaCxCRepository) {}

    async create(data: any): Promise<CategoriaCxcSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<CategoriaCxcSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<CategoriaCxcSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<CategoriaCxcSQL[]> {
        return this.repository.list();
    }
}

// --- Cuentas_Por_Cobrar ---
export class CuentasPorCobrarService implements ICuentasPorCobrarService {
    constructor(private repo: ICuentasPorCobrarRepository) {}

    // Mes a mes, 50 por página (tope), filtrable por categoría/estado.
    async listarPaginado(filtros: { mes?: number; anio?: number; id_categoria?: number; estado?: string; page?: number; limit?: number }): Promise<any> {
        const page = Math.max(1, Number(filtros.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(filtros.limit) || 50));
        const { rows, total } = await this.repo.listarPaginado({ ...filtros, page, limit });
        return { cuentas: rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 } };
    }
}