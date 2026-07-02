// Objeto APP para la entidad de dominio de negocio

export interface ViajeApp {
    id: number;
    numero_viaje: string;
    fecha: Date;
    total_costo_material: number;
    maquila: number;
    total_viaje: number;
    au_promedio_compra: number;
    tenor_au_venta: number;
    total_grs_au_venta: number;
    tenor_ag: number;
    total_grs_ag_venta: number;
    comentarios: string;
    created_at: Date;
    updated_at: Date;
}
