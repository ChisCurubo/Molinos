import { PoolConnection } from 'mysql2/promise';
import { ExcedenteSQL, UpsertExcedenteDTO } from '../../models/material/sql/excedente.sql';

export interface IExcedenteRepository {
    // Excedente único de la entrada (el más reciente si hubiera varios), o null.
    obtenerPorEntrada(id_entrada: number, conn?: PoolConnection): Promise<ExcedenteSQL | null>;
    insertar(id_entrada: number, data: UpsertExcedenteDTO, conn?: PoolConnection): Promise<number>;
    actualizar(id: number, data: UpsertExcedenteDTO, conn?: PoolConnection): Promise<void>;
    eliminar(id: number, conn?: PoolConnection): Promise<void>;
}

export interface IExcedenteService {
    obtenerDeEntrada(idEntrada: number): Promise<ExcedenteSQL | null>;
    // Upsert 1:1: crea/actualiza el excedente, o lo elimina si el valor es 0 (devuelve null).
    registrarOActualizar(idEntrada: number, data: UpsertExcedenteDTO): Promise<ExcedenteSQL | null>;
}
