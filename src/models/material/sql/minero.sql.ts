// Automáticamente generado a partir de molinos_create_v4.sql

export interface MineroSQL {
    id: number;
    nombre: string;
    titular?: string;
    cc?: string;
    alias: string;
    telefono: string;
    ciudad: string;
    banco?: string;
    numero_cuenta?: string;
    nequi: boolean;
    metodo_calculo: string;
    estado: string;
    created_at: Date;
    updated_at: Date;
}
