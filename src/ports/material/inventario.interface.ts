import { PoolConnection } from 'mysql2/promise';

export interface IInventarioRepository {
    obtenerMaterialCrudo(): Promise<any[]>;
    obtenerConcentrado(): Promise<any[]>;
    obtenerResumenLote(idLote: number): Promise<any>;
    obtenerResumenInventario(): Promise<any>;

    // --- Lógica migrada de triggers de BD (ver triguer_v5.sql) ---
    // Reemplaza al trigger 'trg_after_insert_mpe': al crear una entrada crea su
    // lote en Inventario_Lotes + el movimiento de Kardex (y el Excedente si aplica).
    triggerAlCrearEntrada(entrada: any, tx?: PoolConnection): Promise<void>;
    // Reemplaza al trigger 'trg_after_update_mpe': cuando llega el análisis
    // (total_material_seco pasa de 0 a >0) corrige el lote de bruto a seco:
    // sin salidas → ajusta toneladas + kardex AJUSTE_MERMA; con salidas → solo metadata.
    triggerAlActualizarAnalisis(oldEntrada: any, newEntrada: any, tx?: PoolConnection): Promise<void>;
}

export interface IInventarioService {
    obtenerMaterialCrudo(): Promise<any[]>;
    obtenerConcentrado(): Promise<any[]>;
    obtenerResumenLote(idLote: number): Promise<any>;
    obtenerResumenInventario(): Promise<any>;

    // Métodos "trigger" internos (no expuestos por HTTP): los invocan
    // material.service (al registrar la entrada) y analisis.service (al vincular/actualizar
    // el análisis), dentro de la misma transacción.
    triggerAlCrearEntrada(entrada: any, tx?: PoolConnection): Promise<void>;
    triggerAlActualizarAnalisis(oldEntrada: any, newEntrada: any, tx?: PoolConnection): Promise<void>;
}
