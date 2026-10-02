import { CuentaPorPagarSQL } from '../../../models/pagos/sql/cuenta_por_pagar.sql';
import { CategoriaCxpSQL } from '../../../models/pagos/sql/categoria_cxp.sql';

// --- Original: cuentas_por_pagar ---
export interface CuentasPorPagarServiceInterface {
    registrarCuenta(cuenta: Partial<CuentaPorPagarSQL>): Promise<CuentaPorPagarSQL>;
    obtenerCuenta(id: number): Promise<CuentaPorPagarSQL>;
    listarCuentas(): Promise<CuentaPorPagarSQL[]>;
    listarCuentasPorEstado(estado: string): Promise<CuentaPorPagarSQL[]>;
    listarPaginado(filtros: { mes?: number; anio?: number; id_categoria?: number; estado?: string; page?: number; limit?: number }): Promise<any>;
    actualizarEstadoPago(id: number, pagoAdicional: number): Promise<boolean>;
}

// --- Original: categoria_cxp ---
export interface ICategoriaCxPService {
    create(data: any): Promise<CategoriaCxpSQL>;
    getById(id: number): Promise<CategoriaCxpSQL | null>;
    update(id: number, data: any): Promise<CategoriaCxpSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CategoriaCxpSQL[]>;
}