export interface MaterialConcentradoSQL {
    id: number;
    codigo: string;
    fecha_inicio: Date;
    fecha_fin: Date | null;
    estado: string;
    total_toneladas_humedo: number;
    porcentaje_humedad: number;
    total_toneladas_seco: number;
    costo_total_material: number;
    costo_total_maquila: number;
    costo_total_lote: number;
    created_at: Date;
    updated_at: Date;
}

export interface ProcesamientoMaterialSQL {
    id: number;
    id_material_concentrado: number;
    id_entrada: number;
    fecha_procesamiento: Date;
    toneladas_aportadas: number;
    toneladas_seco_aportadas: number;
    created_at: Date;
}
