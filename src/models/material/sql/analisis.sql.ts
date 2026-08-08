// Automáticamente generado a partir de molinos_create_v4.sql

export interface AnalisisSQL {
    id: number;
    id_entrada?: number;
    id_material_concentrado?: number;
    id_tipo_analisis: number;
    id_mina?: number;
    id_minero?: number;
    id_tipo_material?: number;
    id_laboratorio?: number;
    numero_analisis: string;
    au_concentrado: number;
    ag_concentrado: number;
    ton: number;
    porcentaje_humedad: number;
    toneladas_humedas: number;
    toneladas_secas: number;
    au_gr_x_ton: number;
    au_falso?: number;
    ag_gr_x_ton: number;
    valor_analisis?: number;
    estado_pago: string;
    fecha_salida: Date;
    comentarios: string;
    created_at: Date;
}

import { RowDataPacket } from 'mysql2/promise';

export enum EstadoPagoAnalisis {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
  NO_APLICA = 'no_aplica'
}

export interface CreateAnalisisDTO {
  id_entrada?: number;
  id_material_concentrado?: number;
  id_tipo_analisis: number;
  id_laboratorio?: number;
  id_tipo_material?: number;
  numero_analisis: string;
  // Opcional: si se omite en un análisis de cabeza, el Service usa el peso_llegada_planta de la entrada.
  toneladas?: number;
  porcentaje_humedad: number;
  au_concentrado: number;
  ag_concentrado: number;
  au_falso: number;
  comentarios?: string;
  // Calculated fields populated by service
  toneladas_humedas?: number;
  toneladas_secas?: number;
  au_gr_x_ton?: number;
  ag_gr_x_ton?: number;
}

export interface UpdateAnalisisDTO {
  id_entrada?: number;
  id_material_concentrado?: number;
  numero_analisis?: string;
  id_laboratorio?: number;
  id_tipo_material?: number;
  toneladas?: number;
  porcentaje_humedad?: number;
  au_concentrado?: number;
  ag_concentrado?: number;
  au_falso?: number;
  comentarios?: string;
  // Calculated fields populated by service
  toneladas_humedas?: number;
  toneladas_secas?: number;
  au_gr_x_ton?: number;
  ag_gr_x_ton?: number;
}

export interface UpdateValorAnalisisDTO {
  valor_analisis: number;
}

export interface Analisis extends RowDataPacket {
  id: number;
  id_entrada?: number;
  id_material_concentrado?: number;
  id_tipo_analisis?: number;
  tipo_analisis: string;
  numero_analisis: string | null;
  porcentaje_humedad: number;
  toneladas_humedas: number | null;
  toneladas_secas: number;
  tenor_real: number;
  tenor_falso: number;
  au_concentrado: number | null;
  ag_concentrado: number | null;
  au_gr_x_ton: number | null;
  ag_gr_x_ton: number | null;
  au_falso: number | null;
  valor_analisis: number | null;
  estado_pago: EstadoPagoAnalisis;
  fecha_salida: Date | null;
  comentarios: string | null;
  created_at: Date;
}
