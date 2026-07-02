// Automáticamente generado a partir de molinos_create_v4.sql

export interface KardexMovimientoSQL {
    id: number;
    id_lote: number;
    fecha: Date;
    tipo_movimiento: string;
    toneladas_movidas: number;
    destino_referencia: string;
    id_usuario: number;
    comentarios: string;
}
