import { ContratoAlquilerSQL } from '../../../models/pagos/sql/contrato_alquiler.sql';

export interface IContratoAlquilerService {
    create(data: any): Promise<{ contrato: ContratoAlquilerSQL; meses: any[] }>;
    getById(id: number): Promise<{ contrato: ContratoAlquilerSQL; meses: any[] } | null>;
    update(id: number, data: any): Promise<ContratoAlquilerSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ContratoAlquilerSQL[]>;
}
