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

// Body para registrar/editar el excedente de una entrada (upsert 1:1 por entrada).
// saldo_por_distribuir es columna calculada por la BD; estado_distribucion arranca
// en 'pendiente' y solo se edita mientras no haya distribución (monto_distribuido = 0).
// El monto se puede enviar de dos formas (excluyentes):
//  - valor_excedente: monto final directo.
//  - tarifa_excedente_por_ton: cobro por tonelada seca; el backend calcula
//    valor_excedente = total_material_seco (de la entrada) × tarifa.
// Si el monto resultante es 0, el excedente se elimina (no se guarda en 0).
export interface UpsertExcedenteDTO {
    valor_excedente?: number;
    tarifa_excedente_por_ton?: number;
    fecha_calculo?: string;
    concepto?: string | null;
    notas?: string | null;
}
