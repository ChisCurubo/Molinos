import { PlantaSQL } from '../../models/nomina/sql/planta.sql';

// --- Original: planta ---
export interface IPlantaRepository {
    create(data: Omit<PlantaSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<PlantaSQL | null>;
    update(id: number, data: Partial<PlantaSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<PlantaSQL[]>;
}