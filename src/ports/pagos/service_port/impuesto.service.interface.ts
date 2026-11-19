import { ImpuestoAplicadoSQL, ImpuestoSQL } from '../../../models/pagos/sql/impuesto.sql';
import { FiltrosImpuestosAplicados } from '../repository_port/impuesto.repository.interface';

export interface IImpuestoService {
    list(): Promise<ImpuestoSQL[]>;
    listarAplicados(filtros: FiltrosImpuestosAplicados): Promise<ImpuestoAplicadoSQL[]>;
}
