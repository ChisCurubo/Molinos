// Objeto APP para la entidad de dominio de negocio

import { RolApp } from './rol.app';
import { PermisoApp } from './permiso.app';

export interface RolPermisoApp {
    rol?: RolApp;
    permiso?: PermisoApp;
}
