import { DuenoVolquetaSQL } from '../../../models/material/sql/dueno_volqueta.sql';

// --- Original: dueno_volqueta ---
export interface IDuenoVolquetaService {
    create(data: any): Promise<DuenoVolquetaSQL>;
    getById(id: number): Promise<DuenoVolquetaSQL | null>;
    update(id: number, data: any): Promise<DuenoVolquetaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<DuenoVolquetaSQL[]>;
}