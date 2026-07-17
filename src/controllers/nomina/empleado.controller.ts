import { Request, Response } from 'express';
import { IEmpleadoService } from '../../ports/nomina/service_port/empleado.service.interface';
import { EmpleadoService } from '../../services/nomina/empleado.service';
import { PrestamoEmpleadoServiceInterface } from '../../ports/nomina/service_port/empleado.service.interface';

// --- Original: empleado ---
export class EmpleadoController {
    constructor(private service: IEmpleadoService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.service.create(req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = await this.service.getById(id);
            if (!result) {
                res.status(404).json({ success: false, error: 'Registro no encontrado' });
                return;
            }
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = await this.service.update(id, req.body);
            if (!result) {
                res.status(404).json({ success: false, error: 'Registro no encontrado o sin cambios' });
                return;
            }
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const deleted = await this.service.delete(id);
            if (!deleted) {
                res.status(404).json({ success: false, error: 'Registro no encontrado' });
                return;
            }
            res.status(200).json({ success: true, message: 'Registro eliminado' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const results = await this.service.list();
            res.status(200).json({ success: true, data: results });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };
}

// --- Original: prestamo_empleado ---
export class PrestamoEmpleadoController {
    constructor(private service: PrestamoEmpleadoServiceInterface) {}

    async registrar(req: Request, res: Response) {
        try {
            const prestamo = await this.service.registrarPrestamo(req.body);
            res.status(201).json({ success: true, data: prestamo });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async listarPorEmpleado(req: Request, res: Response) {
        try {
            const { idEmpleado } = req.params;
            const prestamos = await this.service.listarPrestamosPorEmpleado(Number(idEmpleado));
            res.status(200).json({ success: true, data: prestamos });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const prestamo = await this.service.updatePrestamo(id, req.body);
            if (!prestamo) {
                res.status(404).json({ success: false, message: "Préstamo no encontrado o no actualizado" });
                return;
            }
            res.status(200).json({ success: true, data: prestamo });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}