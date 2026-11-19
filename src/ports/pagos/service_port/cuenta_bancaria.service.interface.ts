import { CuentaBancariaSQL } from '../../../models/pagos/sql/cuenta_bancaria.sql';

export interface ICuentaBancariaService {
    create(data: any): Promise<CuentaBancariaSQL>;
    getById(id: number): Promise<CuentaBancariaSQL | null>;
    update(id: number, data: any): Promise<CuentaBancariaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<CuentaBancariaSQL[]>;
    getSaldo(id: number): Promise<any>;
    listarSaldos(): Promise<any[]>;
}
