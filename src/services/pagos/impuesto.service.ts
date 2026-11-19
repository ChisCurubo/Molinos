import { FiltrosImpuestosAplicados, IImpuestoRepository } from '../../ports/pagos/repository_port/impuesto.repository.interface';
import { IImpuestoService } from '../../ports/pagos/service_port/impuesto.service.interface';
import { ImpuestoAplicadoSQL, ImpuestoSQL } from '../../models/pagos/sql/impuesto.sql';

export class ImpuestoService implements IImpuestoService {
    constructor(private repo: IImpuestoRepository) {}

    async list(): Promise<ImpuestoSQL[]> {
        return this.repo.list();
    }

    async listarAplicados(filtros: FiltrosImpuestosAplicados): Promise<ImpuestoAplicadoSQL[]> {
        return this.repo.listarAplicados(filtros);
    }
}
