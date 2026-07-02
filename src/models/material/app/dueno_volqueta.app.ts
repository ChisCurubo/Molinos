// Objeto APP para la entidad de dominio de negocio

export interface DuenoVolquetaApp {
    id: number;
    nombre: string;
    titular?: string;
    cc?: string;
    banco?: string;
    numero_cuenta?: string;
    alias: string;
    telefono: string;
    ciudad: string;
    nequi: boolean;
    estado: string;
    created_at: Date;
    updated_at: Date;
}
