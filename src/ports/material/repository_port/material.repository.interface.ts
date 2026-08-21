import { MaterialPlantaEntradaSQL } from '../../../models/material/sql/material_planta_entrada.sql';
import { TipoMaterialSQL } from '../../../models/material/sql/tipo_material.sql';
import { PrecioMaterialSQL } from '../../../models/material/sql/precio_material.sql';
import { TarifaCalculoSQL } from '../../../models/material/sql/tarifa_calculo.sql';
import { ProveedorSQL } from '../../../models/pagos/sql/proveedor.sql';

import { PoolConnection } from 'mysql2/promise';

import { CreateMaterialEntradaDTO, UpdateDesdeAnalisisDTO, UpdatePrecioDTO, PrecioManualCalculadoDTO, GastosOperativosCalculadoDTO, UpdateCostosDTO, UpdateCompletoDTO, EntradaMaterial, EstadoEntrada, EstadoPagoFlete } from '../../../models/material/sql/material_planta_entrada.sql';

// --- Original: material_planta_entrada ---
export interface IMaterialEntradaRepository {
    registrarLlegada(data: CreateMaterialEntradaDTO, conn?: PoolConnection): Promise<number>;
    obtenerPorId(id: number, conn?: PoolConnection): Promise<EntradaMaterial | null>;
    listar(fechaDesde: string, fechaHasta: string, estado?: string, limit?: number, offset?: number, conn?: PoolConnection): Promise<any[]>;
    listarPendientesAnalisis(conn?: PoolConnection): Promise<any[]>;
    actualizarDesdeAnalisis(id: number, data: UpdateDesdeAnalisisDTO, conn?: PoolConnection): Promise<void>;
    actualizarPrecio(id: number, data: UpdatePrecioDTO, conn?: PoolConnection): Promise<void>;
    asignarPrecioManual(id: number, data: PrecioManualCalculadoDTO, conn?: PoolConnection): Promise<void>;
    actualizarGastosOperativos(id: number, data: GastosOperativosCalculadoDTO, conn?: PoolConnection): Promise<void>;
    actualizarCostos(id: number, data: UpdateCostosDTO, conn?: PoolConnection): Promise<void>;
    actualizarExcedente(id: number, excedente_calculado: number, total_material: number, conn?: PoolConnection): Promise<void>;
    actualizarCompleto(id: number, data: UpdateCompletoDTO, conn?: PoolConnection): Promise<void>;
    resetearCalculos(id: number, conn?: PoolConnection): Promise<void>;
    actualizarEstado(id: number, estado: EstadoEntrada, conn?: PoolConnection): Promise<void>;
    actualizarEstadoPagoFlete(id: number, estado: EstadoPagoFlete, conn?: PoolConnection): Promise<void>;
    cancelar(id: number, motivo: string, conn?: PoolConnection): Promise<void>;
    listarPorMinero(id_minero: number, conn?: PoolConnection): Promise<any[]>;
    listarPorMina(id_mina: number, conn?: PoolConnection): Promise<any[]>;
    listarPorVehiculo(id_vehiculo: number, conn?: PoolConnection): Promise<any[]>;
    listarPorDueno(id_dueno: number, conn?: PoolConnection): Promise<any[]>;
    listarPorFecha(fecha: string, conn?: PoolConnection): Promise<any[]>;
    estadisticas(conn?: PoolConnection): Promise<any>;
    actualizarBase(id: number, data: Partial<CreateMaterialEntradaDTO>, conn?: PoolConnection): Promise<boolean>;
    contarAnalisis(id: number, conn?: PoolConnection): Promise<number>;
    eliminar(id: number, conn?: PoolConnection): Promise<boolean>;
    eliminarInventarioDeEntrada(id: number, conn?: PoolConnection): Promise<void>;
    contarSalidasInventario(id: number, conn?: PoolConnection): Promise<number>;
}

// --- Original: tipo_material ---
export interface ITipoMaterialRepository {
    create(data: Omit<TipoMaterialSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoMaterialSQL | null>;
    update(id: number, data: Partial<TipoMaterialSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoMaterialSQL[]>;
}

// --- Original: precio_material ---
export interface IPrecioMaterialRepository {
    create(data: Omit<PrecioMaterialSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<PrecioMaterialSQL | null>;
    update(id: number, data: Partial<PrecioMaterialSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<PrecioMaterialSQL[]>;
    
    // Query 2.1 Buscar precio aplicable
    buscarPrecioAplicable(idMinero: number | null, idZona: number | null, metodo: string, tenorFalso: number, fechaEntrada: string, conn?: PoolConnection): Promise<any | null>;
    
    // Batch insert
    insertarLote(precios: Omit<PrecioMaterialSQL, 'id'>[], conn?: PoolConnection): Promise<void>;

    // Versionado de precios
    desactivarPreciosVigentes(idMinero: number | null, idZona: number | null, metodo: string, conn?: PoolConnection): Promise<void>;
    reemplazarLoteVigente(idMinero: number | null, idZona: number | null, metodo: string, precios: Omit<PrecioMaterialSQL, 'id'>[]): Promise<void>;
    reemplazarIntervalo(id: number, data: any): Promise<number>;

    // Listado con filtros (id_minero / id_zona / alcance='general' / activo)
    listar(filtros?: { id_minero?: number | null; id_zona?: number | null; alcance?: string; activo?: boolean }): Promise<any[]>;
}

// --- Original: tarifa_calculo ---
export interface ITarifaCalculoRepository {
    create(data: Omit<TarifaCalculoSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TarifaCalculoSQL | null>;
    update(id: number, data: Partial<TarifaCalculoSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TarifaCalculoSQL[]>;
    
    // Queries 2.2 y 2.3
    obtenerTarifaZonaOCalculo(idZona: number | null, conn?: PoolConnection): Promise<number>;
}

// --- Original: proveedor ---
export interface IProveedorRepository {
    create(data: Omit<ProveedorSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<ProveedorSQL | null>;
    update(id: number, data: Partial<ProveedorSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ProveedorSQL[]>;
}
