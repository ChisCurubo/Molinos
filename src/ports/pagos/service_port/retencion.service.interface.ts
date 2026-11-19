import { ConceptoRetencionSQL, RetencionAplicadaSQL } from '../../../models/pagos/sql/retencion.sql';
import { FiltrosRetencionesAplicadas } from '../repository_port/retencion.repository.interface';

export interface IRetencionService {
    list(): Promise<ConceptoRetencionSQL[]>;
    listarAplicados(filtros: FiltrosRetencionesAplicadas): Promise<RetencionAplicadaSQL[]>;
    ajustarAplicada(id: number, valorRetenido: number): Promise<RetencionAplicadaSQL>;
}
