import { PoolConnection } from 'mysql2/promise';
import { ConceptoRetencionSQL, RetencionAplicadaSQL } from '../../../models/pagos/sql/retencion.sql';

export interface FiltrosRetencionesAplicadas {
    id_cuenta_pagar?: number;
    tipo?: 'fuente' | 'iva';
    desde?: string;
    hasta?: string;
}

export interface IRetencionRepository {
    list(): Promise<ConceptoRetencionSQL[]>;
    listarAplicados(filtros: FiltrosRetencionesAplicadas): Promise<RetencionAplicadaSQL[]>;
    obtenerAplicada(id: number, conn?: PoolConnection): Promise<RetencionAplicadaSQL | null>;
}
