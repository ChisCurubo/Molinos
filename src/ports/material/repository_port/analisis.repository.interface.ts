import { TipoAnalisisSQL } from '../../../models/material/sql/tipo_analisis.sql';
import { CreateAnalisisDTO, UpdateAnalisisDTO, Analisis, EstadoPagoAnalisis } from '../../../models/material/sql/analisis.sql';
import { PoolConnection } from 'mysql2/promise';

// --- Original: tipo_analisis ---
export interface ITipoAnalisisRepository {
    create(data: Omit<TipoAnalisisSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<TipoAnalisisSQL | null>;
    update(id: number, data: Partial<TipoAnalisisSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoAnalisisSQL[]>;
}

export interface IAnalisisRepository {
    insertar(data: CreateAnalisisDTO, conn?: PoolConnection): Promise<number>;
    actualizar(identificador: string | number, data: UpdateAnalisisDTO, conn?: PoolConnection): Promise<boolean>;
    actualizarValor(identificador: string | number, valor_analisis: number, conn?: PoolConnection): Promise<boolean>;
    obtenerCabezaPorEntrada(id_entrada: number, conn?: PoolConnection): Promise<Analisis | null>;
    obtenerTodosPorEntrada(id_entrada: number, conn?: PoolConnection): Promise<Analisis[]>;
    actualizarEstadoPago(id: number, estado: EstadoPagoAnalisis, conn?: PoolConnection): Promise<void>;
    obtenerPorId(id: number, conn?: PoolConnection): Promise<Analisis | null>;
    obtenerPorIdentificador(identificador: string | number, conn?: PoolConnection): Promise<Analisis | null>;
    eliminar(id: number, conn?: PoolConnection): Promise<boolean>;
    listarPorMinero(id_minero: number, conn?: PoolConnection): Promise<any[]>;
    listarPorMina(id_mina: number, conn?: PoolConnection): Promise<any[]>;
    listarPorFecha(fecha: string, conn?: PoolConnection): Promise<any[]>;
}