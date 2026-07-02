import { TurnoSQL } from '../../models/nomina/sql/turno.sql';
import { TipoTurnoSQL } from '../../models/nomina/sql/tipo_turno.sql';

// --- Original: turno ---
export interface ITurnoRepository {
    create(data: Omit<TurnoSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TurnoSQL | null>;
    update(id: number, data: Partial<TurnoSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TurnoSQL[]>;
}

// --- Original: tipo_turno ---
export interface ITipoTurnoRepository {
    create(data: Omit<TipoTurnoSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoTurnoSQL | null>;
    update(id: number, data: Partial<TipoTurnoSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoTurnoSQL[]>;
}