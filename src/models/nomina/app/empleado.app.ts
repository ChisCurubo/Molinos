// Objeto APP para la entidad de dominio de negocio

export interface EmpleadoApp {
    id: number;
    nombre: string;
    apellido: string;
    cc: string;
    cuenta: string;
    nequi: boolean;
    labor: string;
    created_at: Date;
}
