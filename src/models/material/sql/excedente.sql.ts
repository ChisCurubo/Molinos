// Automáticamente generado a partir de molinos_create_v4.sql

export interface ExcedenteSQL {
    id: number;
    id_entrada: number;
    valor_excedente: number;
    monto_distribuido: number;
    saldo_por_distribuir: number;
    fecha_calculo: Date;
    concepto?: string;
    estado_distribucion: string;
    notas: string;
    created_at: Date;
    updated_at: Date;
}
