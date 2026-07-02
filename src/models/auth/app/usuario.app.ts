// Objeto APP para la entidad de dominio de negocio

import { RolApp } from './rol.app';
import { EmpleadoApp } from '../../nomina/app/empleado.app';

export interface UsuarioApp {
    id: number;
    username: string;
    password_hash: string;
    rol?: RolApp;
    empleado?: EmpleadoApp;
    activo: boolean;
    ultimo_acceso?: Date;
    created_at: Date;
}
