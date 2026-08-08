import { PoolConnection } from 'mysql2/promise';
import { MinaSQL } from '../../../models/material/sql/mina.sql';
import { MineroSQL } from '../../../models/material/sql/minero.sql';
import { ZonaSQL } from '../../../models/material/sql/zona.sql';
import { TarifaZonaSQL } from '../../../models/material/sql/tarifa_zona.sql';

// --- Original: mina ---
export interface IMinaRepository {
    create(data: Omit<MinaSQL, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
    getById(id: number): Promise<MinaSQL | null>;
    update(id: number, data: Partial<MinaSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<MinaSQL[]>;
    obtenerZonaDeMina(idMina: number, conn?: PoolConnection): Promise<number | null>;
}

// --- Original: minero ---
export interface IMineroRepository {
    create(data: Omit<MineroSQL, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
    getById(id: number): Promise<MineroSQL | null>;
    update(id: number, data: Partial<MineroSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<MineroSQL[]>;
}

// --- Original: zona ---
export interface IZonaRepository {
    create(data: Omit<ZonaSQL, 'id' | 'created_at'>): Promise<number>;
    getById(id: number): Promise<ZonaSQL | null>;
    update(id: number, data: Partial<ZonaSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ZonaSQL[]>;
}

// --- Original: tarifa_zona ---
export interface ITarifaZonaRepository {
    create(data: Omit<TarifaZonaSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TarifaZonaSQL | null>;
    update(id: number, data: Partial<TarifaZonaSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TarifaZonaSQL[]>;
}