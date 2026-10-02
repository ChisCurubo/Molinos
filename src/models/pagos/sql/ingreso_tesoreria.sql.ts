export interface CategoriaIngresoSQL {
    id: number;
    nombre: string;
    descripcion: string | null;
}

export interface IngresoTesoreriaSQL {
    id: number;
    id_categoria: number;
    concepto: string;
    valor: number;
    fecha: Date;
    id_prestamo_fin: number | null;
    comprobante_url: string | null;
    created_at: Date;
}
