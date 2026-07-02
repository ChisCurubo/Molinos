import { MaterialPlantaEntradaSQL } from '../../models/material/sql/material_planta_entrada.sql';
import { MaterialPlantaEntradaRepositoryInterface } from '../../ports/material/repository_port/material.repository.interface';
import { IMaterialEntradaService } from '../../ports/material/service_port/material.service.interface';
import { ITipoMaterialService } from '../../ports/material/service_port/material.service.interface';
import { ITipoMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { TipoMaterialRepository } from '../../repositories/material/material.repository';
import { TipoMaterialSQL } from '../../models/material/sql/tipo_material.sql';
import { IPrecioMaterialService } from '../../ports/material/service_port/material.service.interface';
import { IPrecioMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { PrecioMaterialRepository } from '../../repositories/material/material.repository';
import { PrecioMaterialSQL } from '../../models/material/sql/precio_material.sql';
import { ITarifaCalculoService } from '../../ports/material/service_port/material.service.interface';
import { ITarifaCalculoRepository } from '../../ports/material/repository_port/material.repository.interface';
import { TarifaCalculoRepository } from '../../repositories/material/material.repository';
import { TarifaCalculoSQL } from '../../models/material/sql/tarifa_calculo.sql';
import { IProveedorService } from '../../ports/material/service_port/material.service.interface';
import { IProveedorRepository } from '../../ports/material/repository_port/material.repository.interface';
import { ProveedorRepository } from '../../repositories/material/material.repository';
import { ProveedorSQL } from '../../models/pagos/sql/proveedor.sql';

// --- Original: material_planta_entrada ---
export class MaterialPlantaEntradaService implements IMaterialEntradaService {
    private repo: MaterialPlantaEntradaRepositoryInterface;

    constructor(repo: MaterialPlantaEntradaRepositoryInterface) {
        this.repo = repo;
    }

    async registrarEntrada(entrada: Partial<MaterialPlantaEntradaSQL>): Promise<MaterialPlantaEntradaSQL> {
        return await this.repo.create(entrada);
    }

    async obtenerEntrada(id: number): Promise<MaterialPlantaEntradaSQL> {
        const entrada = await this.repo.getById(id);
        if (!entrada) throw new Error('Entrada de material no encontrada');
        return entrada;
    }

    async listarEntradas(): Promise<MaterialPlantaEntradaSQL[]> {
        return await this.repo.listAll();
    }

    async actualizarEntrada(id: number, entrada: Partial<MaterialPlantaEntradaSQL>): Promise<boolean> {
        return await this.repo.update(id, entrada);
    }

    async vincularAnalisis(analisisData: any): Promise<void> {
        // Dummy implementation since this is handled by AnalisisService now
        throw new Error("vincularAnalisis was moved to AnalisisService.vincularAnalisisAEntrada");
    }

    async registrarLlegada(data: any): Promise<number> {
        const result = await this.repo.create(data);
        return result.id;
    }

    async listar(fechaDesde: string, fechaHasta: string, estado: string, limit: number, offset: number): Promise<any[]> {
        return await this.repo.listar(fechaDesde, fechaHasta, estado, limit, offset);
    }

    async listarPendientesLaboratorio(): Promise<any[]> {
        return await this.repo.listarPendientesLaboratorio();
    }
}

// --- Original: tipo_material ---
export class TipoMaterialService implements ITipoMaterialService {
    private repository: ITipoMaterialRepository;

    constructor() {
        this.repository = new TipoMaterialRepository();
    }

    async create(data: any): Promise<TipoMaterialSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TipoMaterialSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TipoMaterialSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TipoMaterialSQL[]> {
        return this.repository.list();
    }
}

// --- Original: precio_material ---
export class PrecioMaterialService implements IPrecioMaterialService {
    private repository: IPrecioMaterialRepository;

    constructor() {
        this.repository = new PrecioMaterialRepository();
    }

    async create(data: any): Promise<PrecioMaterialSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<PrecioMaterialSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<PrecioMaterialSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<PrecioMaterialSQL[]> {
        return this.repository.list();
    }

    async buscarPrecio(idMinero: number | null, idZona: number | null, metodo: string, tenorFalso: number, fechaEntrada: string | Date, conn?: any): Promise<any | null> {
        return this.repository.buscarPrecioAplicable(idMinero, idZona, metodo, tenorFalso, fechaEntrada as string, conn);
    }

    async buscarTarifaZona(idZona: number | null, conn?: any): Promise<number> {
        throw new Error("buscarTarifaZona is handled by TarifaCalculoService");
    }
}

// --- Original: tarifa_calculo ---
export class TarifaCalculoService implements ITarifaCalculoService {
    private repository: ITarifaCalculoRepository;

    constructor() {
        this.repository = new TarifaCalculoRepository();
    }

    async create(data: any): Promise<TarifaCalculoSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TarifaCalculoSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TarifaCalculoSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TarifaCalculoSQL[]> {
        return this.repository.list();
    }
}

// --- Original: proveedor ---
export class ProveedorService implements IProveedorService {
    private repository: IProveedorRepository;

    constructor() {
        this.repository = new ProveedorRepository();
    }

    async create(data: any): Promise<ProveedorSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<ProveedorSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<ProveedorSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<ProveedorSQL[]> {
        return this.repository.list();
    }
}