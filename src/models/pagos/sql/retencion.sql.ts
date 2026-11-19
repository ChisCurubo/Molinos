// Automáticamente generado a partir de migracion_retenciones_2026-10-31.sql

export interface ConceptoRetencionSQL {
    id: number;
    nombre: string;
    tarifa_declarante: number;
    tarifa_no_declarante: number;
    base_minima_uvt: number;
    activo: boolean;
}

export interface RetencionAplicadaSQL {
    id: number;
    id_concepto_retencion: number;
    id_cuenta_pagar: number;
    valor_base: number;
    tarifa_aplicada: number;
    valor_retenido: number;
    tipo: 'fuente' | 'iva';
    fecha: Date;
    created_at: Date;
    ajustado_manualmente: boolean;
    valor_calculado_original?: number;
}
