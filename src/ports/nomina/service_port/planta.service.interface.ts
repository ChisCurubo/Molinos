import { PlantaSQL } from '../../models/nomina/sql/planta.sql';

// --- Original: planta ---
export interface IPlantaService {
    create(data: any): Promise<PlantaSQL>;
    getById(id: number): Promise<PlantaSQL | null>;
    update(id: number, data: any): Promise<PlantaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<PlantaSQL[]>;
}