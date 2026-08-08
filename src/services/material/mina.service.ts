import { IMinaService } from '../../ports/material/service_port/mina.service.interface';
import { IMinaRepository } from '../../ports/material/repository_port/mina.repository.interface';
import { MinaRepository } from '../../repositories/material/mina.repository';
import { MinaSQL } from '../../models/material/sql/mina.sql';
import { IMineroService } from '../../ports/material/service_port/mina.service.interface';
import { IMineroRepository } from '../../ports/material/repository_port/mina.repository.interface';
import { MineroRepository } from '../../repositories/material/mina.repository';
import { MineroSQL } from '../../models/material/sql/minero.sql';
import { IZonaService } from '../../ports/material/service_port/mina.service.interface';
import { IZonaRepository } from '../../ports/material/repository_port/mina.repository.interface';
import { ZonaRepository } from '../../repositories/material/mina.repository';
import { ZonaSQL } from '../../models/material/sql/zona.sql';
import { ITarifaZonaService } from '../../ports/material/service_port/mina.service.interface';
import { ITarifaZonaRepository } from '../../ports/material/repository_port/mina.repository.interface';
import { TarifaZonaRepository } from '../../repositories/material/mina.repository';
import { TarifaZonaSQL } from '../../models/material/sql/tarifa_zona.sql';

// --- Original: mina ---
export class MinaService implements IMinaService {
    private repository: MinaRepository;

    constructor(repository: MinaRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<MinaSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<MinaSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<MinaSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<MinaSQL[]> {
        return this.repository.list();
    }
}

// --- Original: minero ---
export class MineroService implements IMineroService {
    private repository: MineroRepository;

    constructor(repository: MineroRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<MineroSQL> {
        // Regla de negocio: el nombre del minero se guarda siempre en MAYÚSCULAS.
        if (typeof data?.nombre === 'string') {
            data.nombre = data.nombre.trim().toUpperCase();
        }
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<MineroSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<MineroSQL | null> {
        // Regla de negocio: el nombre del minero se guarda siempre en MAYÚSCULAS.
        if (typeof data?.nombre === 'string') {
            data.nombre = data.nombre.trim().toUpperCase();
        }
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<MineroSQL[]> {
        return this.repository.list();
    }

    async listarConMinas(): Promise<any[]> {
        return this.repository.listarConMinas();
    }
}

// --- Original: zona ---
export class ZonaService implements IZonaService {
    private repository: ZonaRepository;

    constructor(repository: ZonaRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<ZonaSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<ZonaSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<ZonaSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<ZonaSQL[]> {
        return this.repository.list();
    }
}

// --- Original: tarifa_zona ---
export class TarifaZonaService implements ITarifaZonaService {
    private repository: TarifaZonaRepository;

    constructor(repository: TarifaZonaRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<TarifaZonaSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TarifaZonaSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TarifaZonaSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TarifaZonaSQL[]> {
        return this.repository.list();
    }
}