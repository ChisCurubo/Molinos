import { MaterialPlantaEntradaSQL } from '../../models/material/sql/material_planta_entrada.sql';
import { TipoMaterialSQL } from '../../models/material/sql/tipo_material.sql';
import { PrecioMaterialSQL } from '../../models/material/sql/precio_material.sql';
import { TarifaCalculoSQL } from '../../models/material/sql/tarifa_calculo.sql';
import { ProveedorSQL } from '../../models/pagos/sql/proveedor.sql';

import { PoolConnection } from 'mysql2/promise';

// --- Original: material_planta_entrada ---
export interface MaterialPlantaEntradaRepositoryInterface {
    create(entrada: Partial<MaterialPlantaEntradaSQL>): Promise<MaterialPlantaEntradaSQL>;
    getById(id: number): Promise<MaterialPlantaEntradaSQL | null>;
    listAll(): Promise<MaterialPlantaEntradaSQL[]>;
    update(id: number, entrada: Partial<MaterialPlantaEntradaSQL>): Promise<boolean>;
    
    // New transactional methods
    actualizarFases3a5(id_entrada: number, data: any, conn?: PoolConnection): Promise<void>;
    listar(fechaDesde: string, fechaHasta: string, estado: string, limit: number, offset: number): Promise<any[]>;
    listarPendientesLaboratorio(): Promise<any[]>;
}

// --- Original: tipo_material ---
export interface ITipoMaterialRepository {
    create(data: Omit<TipoMaterialSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoMaterialSQL | null>;
    update(id: number, data: Partial<TipoMaterialSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoMaterialSQL[]>;
}

// --- Original: precio_material ---
export interface IPrecioMaterialRepository {
    create(data: Omit<PrecioMaterialSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<PrecioMaterialSQL | null>;
    update(id: number, data: Partial<PrecioMaterialSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<PrecioMaterialSQL[]>;
    
    // Query 2.1 Buscar precio aplicable
    buscarPrecioAplicable(idMinero: number | null, idZona: number | null, metodo: string, tenorFalso: number, fechaEntrada: string, conn?: PoolConnection): Promise<any | null>;
}

// --- Original: tarifa_calculo ---
export interface ITarifaCalculoRepository {
    create(data: Omit<TarifaCalculoSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TarifaCalculoSQL | null>;
    update(id: number, data: Partial<TarifaCalculoSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TarifaCalculoSQL[]>;
    
    // Queries 2.2 y 2.3
    obtenerTarifaZonaOCalculo(idZona: number | null, conn?: PoolConnection): Promise<number>;
}

// --- Original: proveedor ---
export interface IProveedorRepository {
    create(data: Omit<ProveedorSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<ProveedorSQL | null>;
    update(id: number, data: Partial<ProveedorSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ProveedorSQL[]>;
}
