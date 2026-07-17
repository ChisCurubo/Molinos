import { PrestamoFinancieroSQL } from '../../../models/pagos/sql/prestamo_financiero.sql';

export interface IPrestamoFinancieroService {
    create(data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL>;
    getById(id: number): Promise<PrestamoFinancieroSQL | null>;
    update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL | null>;
    list(): Promise<PrestamoFinancieroSQL[]>;
}
