// Automáticamente generado a partir de molinos_create_v4.sql

export interface MaterialPlantaEntradaSQL {
    id: number;
    numero_volqueta: number;
    id_mina: number;
    id_vehiculo?: number;
    id_tipo_material: number;
    id_precio?: number;
    fecha_llegada: Date;
    peso_llegada_planta: number;
    porcentaje_humedad: number;
    gramos_humedad: number;
    tenor: number;
    total_material_seco: number;
    total_gramos: number;
    precio_por_gramo: number;
    precio_por_tonelada: number;
    precio_total: number;
    excedente_calculado: number;
    costo_cargue: number;
    costo_bascula: number;
    costo_maquila: number;
    costo_adicional: number;
    costo_volqueta: number;
    total_costos_operativos: number;
    total_material: number;
    estado: string;
    estado_pago_flete: string;
    comentarios: string;
    created_at: Date;
    updated_at: Date;
}

import { RowDataPacket } from 'mysql2/promise';

export enum EstadoEntrada {
  PENDIENTE = 'pendiente',
  EN_PROCESO = 'en_proceso',
  PAGADA = 'pagada',
  INCLUIDA_VIAJE = 'incluida_viaje',
  CANCELADA = 'cancelada'
}

export enum EstadoPagoFlete {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
  NO_APLICA = 'no_aplica'
}

export enum MetodoCalculoMinero {
  POR_GRAMO = 'por_gramo',
  POR_TONELADA = 'por_tonelada'
}

export interface NuevaVolquetaDTO {
  placa: string;
  conductor?: string;
  conductor_cc?: string | null;
  id_dueno?: number | null;
  tipo_vehiculo?: string;
  capacidad_ton?: number;
}

export interface CreateMaterialEntradaDTO {
  numero_volqueta: string;
  id_mina: number;
  id_vehiculo?: number;
  id_tipo_material: number;
  fecha_llegada: string;
  peso_llegada_planta: number;
  comentarios?: string;
  // Si id_vehiculo es null y se envía nueva_volqueta, el Service crea el vehículo
  // primero (dentro de la misma transacción) y usa su id como id_vehiculo.
  nueva_volqueta?: NuevaVolquetaDTO | null;
}

export interface UpdateDesdeAnalisisDTO {
  porcentaje_humedad: number;
  gramos_humedad: number;
  total_material_seco: number;
  tenor: number;
  total_gramos: number;
}

export interface UpdatePrecioDTO {
  id_precio: number;
  precio_por_gramo: number | null;
  precio_por_tonelada: number | null;
  precio_total: number;
}

export interface UpdateCostosDTO {
  excedente_calculado: number;
  costo_cargue: number;
  costo_bascula: number;
  costo_maquila: number;
  costo_adicional: number;
  costo_volqueta: number;
  total_costos_operativos: number;
  total_material: number;
}

export interface UpdateCompletoDTO extends UpdateDesdeAnalisisDTO, UpdatePrecioDTO, UpdateCostosDTO {}

export interface EntradaMaterial extends RowDataPacket {
  id: number;
  numero_volqueta: string;
  fecha_llegada: Date;
  estado: EstadoEntrada;
  estado_pago_flete: EstadoPagoFlete;
  mina_id: number;
  mina: string;
  zona_id: number | null;
  minero_id: number | null;
  minero: string | null;
  minero_alias: string | null;
  metodo_calculo: MetodoCalculoMinero | null;
  minero_banco: string | null;
  minero_cuenta: string | null;
  minero_nequi: string | null;
  vehiculo_id: number | null;
  placa: string | null;
  dueno_id: number | null;
  dueno: string | null;
  dueno_alias: string | null;
  tipo_material: string;
  peso_llegada_planta: number;
  porcentaje_humedad: number;
  gramos_humedad: number | null;
  total_material_seco: number | null;
  tenor: number | null;
  total_gramos: number | null;
  id_precio: number | null;
  precio_por_gramo: number | null;
  precio_por_tonelada: number | null;
  precio_total: number | null;
  excedente_calculado: number | null;
  costo_cargue: number | null;
  costo_bascula: number | null;
  costo_maquila: number | null;
  costo_adicional: number | null;
  costo_volqueta: number | null;
  total_costos_operativos: number | null;
  total_material: number | null;
  comentarios: string | null;
  created_at: Date;
  updated_at: Date;
}
