import { PoolConnection } from 'mysql2/promise';
import { CombustibleRow, CrearCombustibleDTO, ResumenMensualCombustibleRow } from '../repository_port/combustible.repository.interface';

// Parámetros para sincronizar el ACPM (una fila 'vehiculo' de Combustible) de un origen.
export interface SyncAcpmParams {
    id_dueno_volqueta?: number | null;
    id_vehiculo?: number | null;
    id_gasolinera?: number | null;
    fecha: string;
    acpm: number;                     // monto del ACPM; 0 o menos ⇒ se elimina la fila
    comprobante_url?: string | null;
}

export interface ICombustibleService {
    sincronizarAcpmEntrada(idEntrada: number, params: SyncAcpmParams, conn: PoolConnection): Promise<void>;
    sincronizarAcpmAgua(idAgua: number, params: SyncAcpmParams, conn: PoolConnection): Promise<void>;
    eliminarAcpmEntrada(idEntrada: number, conn: PoolConnection): Promise<void>;
    eliminarAcpmAgua(idAgua: number, conn: PoolConnection): Promise<void>;
    sumaAcpmEntrada(idEntrada: number, conn?: PoolConnection): Promise<number>;
    calcularNetoFletePorDueno(idDueno: number): Promise<any>;
    listar(filtros: { desde?: string; hasta?: string; id_gasolinera?: number; id_dueno_volqueta?: number; tipo_consumo?: string; forma_pago?: string }): Promise<CombustibleRow[]>;
    obtenerPorId(id: number): Promise<CombustibleRow | null>;

    // --- Registro manual (tanqueos de planta/maquinaria/vehículo, no atados a un viaje) ---
    registrar(data: CrearCombustibleDTO): Promise<CombustibleRow>;
    actualizar(id: number, data: Partial<CrearCombustibleDTO>): Promise<CombustibleRow>;
    eliminar(id: number): Promise<void>;

    // --- Reportes / KPIs ---
    resumenMensual(filtros: { anio?: number; forma_pago?: string; tipo_consumo?: string }): Promise<ResumenMensualCombustibleRow[]>;
    kpis(): Promise<any>;
}
