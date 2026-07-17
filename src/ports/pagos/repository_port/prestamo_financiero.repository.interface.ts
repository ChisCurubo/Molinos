import { PrestamoFinancieroSQL } from '../../../models/pagos/sql/prestamo_financiero.sql';

export interface IPrestamoFinancieroRepository {
    create(data: Partial<PrestamoFinancieroSQL>): Promise<number>;
    getById(id: number): Promise<PrestamoFinancieroSQL | null>;
    update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<boolean>;
    list(): Promise<PrestamoFinancieroSQL[]>;
}
