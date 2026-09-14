import { TipoAnalisisSQL } from '../../../models/material/sql/tipo_analisis.sql';
import { Analisis, EstadoPagoAnalisis } from '../../../models/material/sql/analisis.sql';

// --- Original: tipo_analisis ---
export interface ITipoAnalisisService {
    create(data: any): Promise<TipoAnalisisSQL>;
    getById(id: number): Promise<TipoAnalisisSQL | null>;
    update(id: number, data: any): Promise<TipoAnalisisSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoAnalisisSQL[]>;
}

export interface IAnalisisService {
    vincularAnalisisAEntrada(data: any): Promise<void>;
    actualizarAnalisis(identificador: string | number, data: any): Promise<void>;
    agregarValorAnalisis(identificador: string | number, valor_analisis: number): Promise<void>;
    obtenerCabezaPorEntrada(id_entrada: number): Promise<any | null>;
    obtenerTodosPorEntrada(id_entrada: number): Promise<any[]>;
    eliminarAnalisis(id: number): Promise<void>;
    obtenerPorId(id: number): Promise<Analisis | null>;
    listarPorMinero(id_minero: number): Promise<any[]>;
    listarPorMina(id_mina: number): Promise<any[]>;
    listarPorFecha(fecha: string): Promise<any[]>;
    obtenerAnalisisDeConcentrado(id_lote: number): Promise<any[]>;
    actualizarEstadoPago(id: number, estado: EstadoPagoAnalisis): Promise<void>;
}