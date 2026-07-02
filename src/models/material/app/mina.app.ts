// Objeto APP para la entidad de dominio de negocio

import { MineroApp } from './minero.app';
import { ZonaApp } from './zona.app';

export interface MinaApp {
    id: number;
    nombre: string;
    minero?: MineroApp;
    zona?: ZonaApp;
    ubicacion: string;
    estado: string;
    created_at: Date;
    updated_at: Date;
}
