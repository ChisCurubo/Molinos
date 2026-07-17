import { Pool } from 'mysql2/promise';
import { MaterialPlantaEntradaSQL, EstadoEntrada } from '../../models/material/sql/material_planta_entrada.sql';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';
import { IMaterialEntradaRepository } from '../../ports/material/repository_port/material.repository.interface';
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
    private repo: IMaterialEntradaRepository;
    private db: Pool;
    private triggerLogicRepo: TriggerLogicRepository;

    constructor(repo: IMaterialEntradaRepository, db: Pool, triggerLogicRepo: TriggerLogicRepository) {
        this.repo = repo;
        this.db = db;
        this.triggerLogicRepo = triggerLogicRepo;
    }

    async registrarLlegada(data: any): Promise<number> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const id = await this.repo.registrarLlegada(data, conn);
            const newRow = await this.repo.obtenerPorId(id, conn);

            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_after_insert_mpe' de la BD.
            // await this.triggerLogicRepo.afterInsertMPE(conn, newRow);

            await conn.commit();
            return id;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async obtenerEntrada(id: number): Promise<any> {
        const entrada = await this.repo.obtenerPorId(id);
        if (!entrada) throw new Error('Entrada de material no encontrada');
        return entrada;
    }

    async listarEntradas(fechaDesde: string, fechaHasta: string, estado: string, limit: number, offset: number): Promise<any[]> {
        return await this.repo.listar(fechaDesde, fechaHasta, estado, limit, offset);
    }

    async listarPendientesLaboratorio(): Promise<any[]> {
        return await this.repo.listarPendientesAnalisis();
    }

    async vincularAnalisis(analisisData: any): Promise<void> {
        throw new Error("vincularAnalisis was moved to AnalisisService.vincularAnalisisAEntrada");
    }

    async listarPorMinero(idMinero: number): Promise<any[]> {
        return await this.repo.listarPorMinero(idMinero);
    }

    async listarPorMina(idMina: number): Promise<any[]> {
        return await this.repo.listarPorMina(idMina);
    }

    async listarPorVehiculo(idVehiculo: number): Promise<any[]> {
        return await this.repo.listarPorVehiculo(idVehiculo);
    }

    async listarPorDueno(idDueno: number): Promise<any[]> {
        return await this.repo.listarPorDueno(idDueno);
    }

    async listarPorFecha(fecha: string): Promise<any[]> {
        return await this.repo.listarPorFecha(fecha);
    }

    async actualizarEstado(id: number, estado: string): Promise<void> {
        return await this.repo.actualizarEstado(id, estado as EstadoEntrada);
    }

    async cancelar(id: number, motivo: string): Promise<void> {
        return await this.repo.cancelar(id, motivo);
    }
}

// --- Original: tipo_material ---
export class TipoMaterialService implements ITipoMaterialService {
    private repository: ITipoMaterialRepository;

    constructor(repository: ITipoMaterialRepository) {
        this.repository = repository;
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

    constructor(repository: IPrecioMaterialRepository) {
        this.repository = repository;
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

    async insertarLote(data: any): Promise<void> {
        const { id_minero, id_zona, metodo, fecha_inicio, fecha_fin, intervalos } = data;
        if (!intervalos || !Array.isArray(intervalos) || intervalos.length === 0) {
            throw new Error("El arreglo de intervalos es inválido o está vacío");
        }

        const precios: Omit<PrecioMaterialSQL, 'id'>[] = intervalos.map((int: any) => ({
            id_minero: id_minero || null,
            id_zona: id_zona || null,
            metodo: metodo || 'por_gramo',
            precio_por_gramo: int.precio_por_gramo || 0,
            precio_por_tonelada: int.precio_por_tonelada || 0,
            intervalo_tenor_min: int.min,
            intervalo_tenor_max: int.max,
            fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
            fecha_fin: (fecha_fin ? new Date(fecha_fin) : null) as any,
            activo: true,
            created_at: new Date()
        }));

        await this.repository.insertarLote(precios);
    }
}

// --- Original: tarifa_calculo ---
export class TarifaCalculoService implements ITarifaCalculoService {
    private repository: ITarifaCalculoRepository;

    constructor(repository: ITarifaCalculoRepository) {
        this.repository = repository;
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

    constructor(repository: IProveedorRepository) {
        this.repository = repository;
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