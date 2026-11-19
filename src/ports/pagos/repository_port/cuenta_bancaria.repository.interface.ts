import { CuentaBancariaSQL } from '../../../models/pagos/sql/cuenta_bancaria.sql';

export interface ICuentaBancariaRepository {
    create(data: Omit<CuentaBancariaSQL, 'id' | 'created_at'>): Promise<number>;
    getById(id: number): Promise<CuentaBancariaSQL | null>;
    update(id: number, data: Partial<CuentaBancariaSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CuentaBancariaSQL[]>;
    getSaldo(id: number): Promise<any | null>;
    listarSaldos(): Promise<any[]>;
}
