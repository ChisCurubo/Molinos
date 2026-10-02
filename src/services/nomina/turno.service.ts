import { ITurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { ITurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';
import { TurnoRepository } from '../../repositories/nomina/turno.repository';
import { TurnoSQL } from '../../models/nomina/sql/turno.sql';
import { ITipoTurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { ITipoTurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';
import { TipoTurnoRepository } from '../../repositories/nomina/turno.repository';
import { TipoTurnoSQL } from '../../models/nomina/sql/tipo_turno.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };

// --- Original: turno ---
export class TurnoService implements ITurnoService {
    constructor(private repository: ITurnoRepository) {}

    async create(data: any): Promise<TurnoSQL> {
        try {
            const id = await this.repository.create(data);
            const entity = await this.repository.getById(id);
            return entity!;
        } catch (e: any) {
            if (e?.errno === 1062) throw err('Ya existe un turno registrado para ese empleado en esa fecha', 409);
            throw e;
        }
    }

    async getById(id: number): Promise<TurnoSQL | null> {
        return this.repository.getById(id);
    }

    /**
     * Guardado desde la grilla de asistencia (/nomina/calendario): a lo sumo un turno
     * por (id_empleado, fecha) — si ya existe ese día, lo actualiza; si no, lo crea.
     * presente=false (ausencia) fuerza horas_trabajadas=0, sin importar lo que llegue.
     * presente=true (turno normal) exige id_tipo_turno y valida horas entre 1 y 24
     * (default 8 si no se envía).
     */
    async upsert(data: { id_empleado: number; fecha: string; id_tipo_turno?: number; horas_trabajadas?: number; presente?: boolean; id_planta_proceso?: number; comentarios?: string }): Promise<TurnoSQL> {
        if (!data.id_empleado) throw err('id_empleado es requerido');
        if (!data.fecha) throw err('fecha es requerida');

        const presente = data.presente !== false;
        const payload: Partial<TurnoSQL> = { presente: presente as any };

        if (presente) {
            if (!data.id_tipo_turno) throw err('id_tipo_turno es requerido cuando presente=true');
            const horas_trabajadas = data.horas_trabajadas != null ? Number(data.horas_trabajadas) : 8;
            if (!(horas_trabajadas >= 1 && horas_trabajadas <= 24)) throw err('horas_trabajadas debe estar entre 1 y 24');
            payload.id_tipo_turno = data.id_tipo_turno as any;
            payload.horas_trabajadas = horas_trabajadas as any;
        } else {
            // Ausente: horas siempre 0. El tipo es solo un placeholder (id_tipo_turno es NOT
            // NULL en BD) — si no llega uno, el repositorio usa TURNO 1 por defecto al crear;
            // si ya existía un turno ese día, se respeta el tipo que tenía.
            payload.horas_trabajadas = 0 as any;
            if (data.id_tipo_turno) payload.id_tipo_turno = data.id_tipo_turno as any;
        }
        if (data.id_planta_proceso !== undefined) payload.id_planta_proceso = data.id_planta_proceso as any;
        if (data.comentarios !== undefined) payload.comentarios = data.comentarios as any;

        return this.repository.upsert(data.id_empleado, data.fecha, payload);
    }

    async eliminarPorEmpleadoYFecha(id_empleado: number, fecha: string): Promise<boolean> {
        return this.repository.deleteByEmpleadoAndFecha(id_empleado, fecha);
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

    async listByEmpleadoAndMonth(id_empleado: number, mes: number, anio: number): Promise<TurnoSQL[]> {
        return this.repository.listByEmpleadoAndMonth(id_empleado, mes, anio);
    }

    async listByEmpleadoAndQuincena(id_empleado: number, quincena: number, mes: number, anio: number): Promise<TurnoSQL[]> {
        return this.repository.listByEmpleadoAndQuincena(id_empleado, quincena, mes, anio);
    }

    async listByMonth(mes: number, anio: number): Promise<TurnoSQL[]> {
        return this.repository.listByMonth(mes, anio);
    }

    async listByQuincena(quincena: number, mes: number, anio: number): Promise<TurnoSQL[]> {
        return this.repository.listByQuincena(quincena, mes, anio);
    }
}

// --- Original: tipo_turno ---
export class TipoTurnoService implements ITipoTurnoService {
    constructor(private repository: ITipoTurnoRepository) {}

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