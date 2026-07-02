import { TurnoSQL } from '../../models/nomina/sql/turno.sql';
import { TipoTurnoSQL } from '../../models/nomina/sql/tipo_turno.sql';

// --- Original: turno ---
export interface ITurnoService {
    create(data: any): Promise<TurnoSQL>;
    getById(id: number): Promise<TurnoSQL | null>;
    update(id: number, data: any): Promise<TurnoSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TurnoSQL[]>;
}

// --- Original: tipo_turno ---
export interface ITipoTurnoService {
    create(data: any): Promise<TipoTurnoSQL>;
    getById(id: number): Promise<TipoTurnoSQL | null>;
    update(id: number, data: any): Promise<TipoTurnoSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoTurnoSQL[]>;
}