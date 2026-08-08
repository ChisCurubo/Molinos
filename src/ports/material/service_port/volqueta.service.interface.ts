import { DuenoVolquetaSQL } from '../../../models/material/sql/dueno_volqueta.sql';

// --- Original: dueno_volqueta ---
export interface IDuenoVolquetaService {
    create(data: any): Promise<DuenoVolquetaSQL>;
    getById(id: number): Promise<DuenoVolquetaSQL | null>;
    update(id: number, data: any): Promise<DuenoVolquetaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<DuenoVolquetaSQL[]>;
}

// --- Original: volqueta_vehiculo (vehículo vive dentro del módulo volqueta) ---
export interface IVehiculoService {
    list(todas?: boolean): Promise<any[]>;
    getById(id: number): Promise<any | null>;
    create(data: any): Promise<number>;
    update(id: number, data: any): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    listarPorDueno(id_dueno: number): Promise<any[]>;
    listarEntradas(id_vehiculo: number): Promise<any[]>;
    entradasPendientes(id_vehiculo: number): Promise<any[]>;
}