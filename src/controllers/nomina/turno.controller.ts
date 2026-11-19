import { Request, Response } from 'express';
import { ITurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { TurnoService } from '../../services/nomina/turno.service';
import { ITipoTurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { TipoTurnoService } from '../../services/nomina/turno.service';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

// --- Original: turno ---
export class TurnoController {
    constructor(private service: ITurnoService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.service.create(req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            fail(res, error);
        }
    };

    // PUT /nomina/turnos/upsert — grilla de asistencia (/nomina/calendario): a lo sumo un
    // turno por (id_empleado, fecha); crea o actualiza según exista o no.
    upsert = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.service.upsert(req.body);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    // DELETE /nomina/turnos/dia?id_empleado=&fecha= — "Sin turno (limpiar)" del calendario.
    eliminarPorDia = async (req: Request, res: Response): Promise<void> => {
        try {
            const id_empleado = Number(req.query.id_empleado);
            const fecha = String(req.query.fecha || '');
            const eliminado = await this.service.eliminarPorEmpleadoYFecha(id_empleado, fecha);
            res.status(200).json({ success: true, eliminado });
        } catch (error: any) {
            fail(res, error);
        }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = await this.service.getById(id);
            if (!result) {
                fail(res, AppError.http(404, 'Registro no encontrado'));
                return;
            }
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            fail(res, error);
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = await this.service.update(id, req.body);
            if (!result) {
                fail(res, AppError.http(404, 'Registro no encontrado o sin cambios'));
                return;
            }
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            fail(res, error);
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const deleted = await this.service.delete(id);
            if (!deleted) {
                fail(res, AppError.http(404, 'Registro no encontrado'));
                return;
            }
            res.status(200).json({ success: true, message: 'Registro eliminado' });
        } catch (error: any) {
            fail(res, error);
        }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_empleado, quincena, mes, anio } = req.query;
            let results;
            if (id_empleado && quincena && mes && anio) {
                results = await this.service.listByEmpleadoAndQuincena(Number(id_empleado), Number(quincena), Number(mes), Number(anio));
            } else if (id_empleado && mes && anio) {
                results = await this.service.listByEmpleadoAndMonth(Number(id_empleado), Number(mes), Number(anio));
            } else if (quincena && mes && anio) {
                results = await this.service.listByQuincena(Number(quincena), Number(mes), Number(anio));
            } else if (mes && anio) {
                results = await this.service.listByMonth(Number(mes), Number(anio));
            } else {
                results = await this.service.list();
            }
            res.status(200).json({ success: true, data: results });
        } catch (error: any) {
            fail(res, error);
        }
    };
}

// --- Original: tipo_turno ---
export class TipoTurnoController {
    constructor(private service: ITipoTurnoService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.service.create(req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            fail(res, error);
        }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = await this.service.getById(id);
            if (!result) {
                fail(res, AppError.http(404, 'Registro no encontrado'));
                return;
            }
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            fail(res, error);
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = await this.service.update(id, req.body);
            if (!result) {
                fail(res, AppError.http(404, 'Registro no encontrado o sin cambios'));
                return;
            }
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            fail(res, error);
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const deleted = await this.service.delete(id);
            if (!deleted) {
                fail(res, AppError.http(404, 'Registro no encontrado'));
                return;
            }
            res.status(200).json({ success: true, message: 'Registro eliminado' });
        } catch (error: any) {
            fail(res, error);
        }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const results = await this.service.list();
            res.status(200).json({ success: true, data: results });
        } catch (error: any) {
            fail(res, error);
        }
    };
}