import { PoolConnection } from 'mysql2/promise';
import { DuenoVolquetaSQL } from '../../../models/material/sql/dueno_volqueta.sql';

// --- Original: dueno_volqueta ---
export interface IDuenoVolquetaRepository {
    create(data: Omit<DuenoVolquetaSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<DuenoVolquetaSQL | null>;
    update(id: number, data: Partial<DuenoVolquetaSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<DuenoVolquetaSQL[]>;
}

// --- Original: volqueta_vehiculo (vehículo vive dentro del módulo volqueta) ---
export interface IVehiculoRepository {
    list(todas?: boolean): Promise<any[]>;
    getById(id: number): Promise<any | null>;
    create(data: any, conn?: PoolConnection): Promise<number>;
    update(id: number, data: any): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    listarPorDueno(id_dueno: number): Promise<any[]>;
    listarEntradas(id_vehiculo: number): Promise<any[]>;
    listarEntradasPendientesFlete(id_vehiculo: number): Promise<any[]>;
}