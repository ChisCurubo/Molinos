// Objeto APP para la entidad de dominio de negocio

export interface TarifaCalculoApp {
    id: number;
    codigo: string;
    valor: number;
    descripcion: string;
    vigente_desde: Date;
    updated_at: Date;
}
