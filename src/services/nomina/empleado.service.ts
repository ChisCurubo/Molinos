import { IEmpleadoService } from '../../ports/nomina/service_port/empleado.service.interface';
import { IEmpleadoRepository } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { EmpleadoRepository } from '../../repositories/nomina/empleado.repository';
import { EmpleadoSQL } from '../../models/nomina/sql/empleado.sql';
import { PrestamoEmpleadoSQL } from '../../models/nomina/sql/prestamo_empleado.sql';
import { PrestamoEmpleadoRepositoryInterface } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { PrestamoEmpleadoServiceInterface } from '../../ports/nomina/service_port/empleado.service.interface';

// --- Original: empleado ---
export class EmpleadoService implements IEmpleadoService {
    private repository: IEmpleadoRepository;

    constructor() {
        this.repository = new EmpleadoRepository();
    }

    async create(data: any): Promise<EmpleadoSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<EmpleadoSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<EmpleadoSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<EmpleadoSQL[]> {
        return this.repository.list();
    }
}

// --- Original: prestamo_empleado ---
export class PrestamoEmpleadoService implements PrestamoEmpleadoServiceInterface {
    private repo: PrestamoEmpleadoRepositoryInterface;
    private empleadoRepo: IEmpleadoRepository;

    constructor(repo: PrestamoEmpleadoRepositoryInterface, empleadoRepo: IEmpleadoRepository) {
        this.repo = repo;
        this.empleadoRepo = empleadoRepo;
    }

    async registrarPrestamo(req: Partial<PrestamoEmpleadoSQL>): Promise<PrestamoEmpleadoSQL> {
        if (!req.id_empleado || !req.valor || req.valor <= 0) {
            throw new Error("El ID de empleado y un valor válido son requeridos");
        }

        const empleado = await this.empleadoRepo.getById(req.id_empleado);
        if (!empleado) {
            throw new Error("El empleado no existe");
        }

        req.fecha = req.fecha || new Date();
        const id = await this.repo.create(req);
        
        const newPrestamo = await this.repo.getById(id);
        if (!newPrestamo) throw new Error("Error registrando el préstamo");
        
        return newPrestamo;
    }

    async listarPrestamosPorEmpleado(id_empleado: number): Promise<PrestamoEmpleadoSQL[]> {
        return await this.repo.listByEmpleadoSQL(id_empleado);
    }
}