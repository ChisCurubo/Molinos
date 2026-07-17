import { TipoAnalisisSQL } from '../../../models/material/sql/tipo_analisis.sql';

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
}