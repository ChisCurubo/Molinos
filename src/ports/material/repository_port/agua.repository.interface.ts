export interface CreateAguaPlantaDTO {
    id_vehiculo: number;
    id_dueno_volqueta?: number;
    fecha: string;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;
    comprobante_url?: string;
    id_gasolinera?: number | null;   // gasolinera del ACPM (opcional) — se espeja a Combustible
}

export interface UpdateAguaPlantaDTO {
    valor_viaje?: number;
    cantidad_viajes?: number;
    acpm?: number;
    comprobante_url?: string;
    id_gasolinera?: number | null;
}

export interface AguaPlantaSQL {
    id: number;
    fecha: string;
    id_dueno?: number;
    dueno: string;
    alias?: string;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;            // derivado de Combustible (Σ por id_agua)
    valor_total: number;     // BRUTO (valor_viaje × cantidad_viajes)
    valor_neto?: number;     // valor_total − acpm (lo que se le paga al dueño)
    comprobante_url?: string;
    created_at: string;
}

export interface AguaViajeReporteRow {
    id: number;
    fecha: string;
    id_dueno: number;
    dueno: string;
    alias?: string;
    valor_viaje: number;
    cantidad_viajes: number;
    acpm: number;
    valor_total: number;
}

import { PoolConnection } from 'mysql2/promise';

export interface IAguaPlantaRepository {
    registrar(data: CreateAguaPlantaDTO, conn?: PoolConnection): Promise<number>;
    listar(fechaDesde: string, fechaHasta: string): Promise<AguaPlantaSQL[]>;
    listarPorDueno(id_dueno: number): Promise<AguaPlantaSQL[]>;
    resumenPorDueno(fechaDesde: string, fechaHasta: string): Promise<any[]>;
    resumenPorIdDueno(id_dueno: number): Promise<any>;
    actualizar(id: number, data: UpdateAguaPlantaDTO, conn?: PoolConnection): Promise<boolean>;
    obtenerPorId(id: number, conn?: PoolConnection): Promise<AguaPlantaSQL | null>;
    eliminar(id: number, conn?: PoolConnection): Promise<boolean>;
    obtenerViajesPeriodo(fechaDesde: string, fechaHasta: string): Promise<AguaViajeReporteRow[]>;
    obtenerSaldosInicio(fechaDesde: string): Promise<{ id_dueno: number; saldo_inicio: number }[]>;
    // Abonos de agua (Abonos_CxP de CxP categoría 'Agua') agrupados por dueño, bucketeados por
    // el mes de la CxP (fecha_creacion). Sirven para el reporte mensual (abonado ≠ 0).
    abonosAguaPorDueno(fechaDesde: string, fechaHasta: string): Promise<Map<number, number>>;
    abonosAguaAntesPorDueno(fechaDesde: string): Promise<Map<number, number>>;
}
