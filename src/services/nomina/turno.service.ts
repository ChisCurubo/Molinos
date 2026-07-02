import { ITurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { ITurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';
import { TurnoRepository } from '../../repositories/nomina/turno.repository';
import { TurnoSQL } from '../../models/nomina/sql/turno.sql';
import { ITipoTurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { ITipoTurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';
import { TipoTurnoRepository } from '../../repositories/nomina/turno.repository';
import { TipoTurnoSQL } from '../../models/nomina/sql/tipo_turno.sql';

// --- Original: turno ---
export class TurnoService implements ITurnoService {
    private repository: ITurnoRepository;

    constructor() {
        this.repository = new TurnoRepository();
    }

    async create(data: any): Promise<TurnoSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TurnoSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TurnoSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TurnoSQL[]> {
        return this.repository.list();
    }
}

// --- Original: tipo_turno ---
export class TipoTurnoService implements ITipoTurnoService {
    private repository: ITipoTurnoRepository;

    constructor() {
        this.repository = new TipoTurnoRepository();
    }

    async create(data: any): Promise<TipoTurnoSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TipoTurnoSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TipoTurnoSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TipoTurnoSQL[]> {
        return this.repository.list();
    }
}