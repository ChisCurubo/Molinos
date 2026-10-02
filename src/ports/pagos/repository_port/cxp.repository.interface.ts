import { CuentaPorPagarSQL } from '../../../models/pagos/sql/cuenta_por_pagar.sql';
import { CategoriaCxpSQL } from '../../../models/pagos/sql/categoria_cxp.sql';

export interface FiltrosCxPPaginado {
    mes?: number;
    anio?: number;
    id_categoria?: number;
    estado?: string;
    page: number;
    limit: number;
}

// --- Original: cuentas_por_pagar ---
export interface CuentasPorPagarRepositoryInterface {
    create(cuenta: Partial<CuentaPorPagarSQL>): Promise<CuentaPorPagarSQL>;
    getById(id: number): Promise<CuentaPorPagarSQL | null>;
    listAll(): Promise<CuentaPorPagarSQL[]>;
    listByEstado(estado: string): Promise<CuentaPorPagarSQL[]>;
    listarPaginado(filtros: FiltrosCxPPaginado): Promise<{ rows: any[]; total: number }>;
    update(id: number, cuenta: Partial<CuentaPorPagarSQL>): Promise<boolean>;
}

// --- Original: categoria_cxp ---
export interface ICategoriaCxPRepository {
    create(data: Omit<CategoriaCxpSQL, 'id'>): Promise<number>;
    getById(id: number): Promise<CategoriaCxpSQL | null>;
    update(id: number, data: Partial<CategoriaCxpSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaCxpSQL[]>;
}