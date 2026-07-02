// Automáticamente generado a partir de molinos_create_v4.sql

export interface UsuarioSQL {
    id: number;
    username: string;
    password_hash: string;
    id_rol: number;
    id_empleado?: number;
    activo: boolean;
    ultimo_acceso?: Date;
    created_at: Date;
}
