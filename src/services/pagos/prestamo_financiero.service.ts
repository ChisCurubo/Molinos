import { PrestamoFinancieroSQL } from '../../models/pagos/sql/prestamo_financiero.sql';
import { IPrestamoFinancieroRepository } from '../../ports/pagos/repository_port/prestamo_financiero.repository.interface';
import { IPrestamoFinancieroService } from '../../ports/pagos/service_port/prestamo_financiero.service.interface';

export class PrestamoFinancieroService implements IPrestamoFinancieroService {
    constructor(private repository: IPrestamoFinancieroRepository) {}

    async create(data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        if (!entity) throw new Error("Error registrando el préstamo financiero");
        return entity;
    }

    async getById(id: number): Promise<PrestamoFinancieroSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<PrestamoFinancieroSQL | null> {
        const success = await this.repository.update(id, data);
        if (!success) return null;
        return this.repository.getById(id);
    }

    async list(): Promise<PrestamoFinancieroSQL[]> {
        return this.repository.list();
    }
}
