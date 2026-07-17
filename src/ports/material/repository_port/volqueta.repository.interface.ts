import { DuenoVolquetaSQL } from '../../../models/material/sql/dueno_volqueta.sql';

// --- Original: dueno_volqueta ---
export interface IDuenoVolquetaRepository {
    create(data: Omit<DuenoVolquetaSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<DuenoVolquetaSQL | null>;
    update(id: number, data: Partial<DuenoVolquetaSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<DuenoVolquetaSQL[]>;
}