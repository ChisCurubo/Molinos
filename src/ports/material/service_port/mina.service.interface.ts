import { MinaSQL } from '../../../models/material/sql/mina.sql';
import { MineroSQL } from '../../../models/material/sql/minero.sql';
import { ZonaSQL } from '../../../models/material/sql/zona.sql';
import { TarifaZonaSQL } from '../../../models/material/sql/tarifa_zona.sql';

// --- Original: mina ---
export interface IMinaService {
    create(data: any): Promise<MinaSQL>;
    getById(id: number): Promise<MinaSQL | null>;
    update(id: number, data: any): Promise<MinaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<MinaSQL[]>;
}

// --- Original: minero ---
export interface IMineroService {
    create(data: any): Promise<MineroSQL>;
    getById(id: number): Promise<MineroSQL | null>;
    update(id: number, data: any): Promise<MineroSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<MineroSQL[]>;
    listarConMinas(): Promise<any[]>;
}

// --- Original: zona ---
export interface IZonaService {
    create(data: any): Promise<ZonaSQL>;
    getById(id: number): Promise<ZonaSQL | null>;
    update(id: number, data: any): Promise<ZonaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ZonaSQL[]>;
}

// --- Original: tarifa_zona ---
export interface ITarifaZonaService {
    create(data: any): Promise<TarifaZonaSQL>;
    getById(id: number): Promise<TarifaZonaSQL | null>;
    update(id: number, data: any): Promise<TarifaZonaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TarifaZonaSQL[]>;
}

export interface IMinaPrecioMaterialService {
    create(data: any): Promise<any>;
    getById(id: number): Promise<any | null>;
    update(id: number, data: any): Promise<any | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<any[]>;
}