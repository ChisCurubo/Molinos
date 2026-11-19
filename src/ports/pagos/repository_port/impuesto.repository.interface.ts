import { ImpuestoAplicadoSQL, ImpuestoSQL } from '../../../models/pagos/sql/impuesto.sql';

export interface FiltrosImpuestosAplicados {
    id_cuenta_bancaria?: number;
    desde?: string;
    hasta?: string;
}

export interface IImpuestoRepository {
    list(): Promise<ImpuestoSQL[]>;
    listarAplicados(filtros: FiltrosImpuestosAplicados): Promise<ImpuestoAplicadoSQL[]>;
}
