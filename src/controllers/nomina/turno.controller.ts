import { Request, Response } from 'express';
import { ITurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { TurnoService } from '../../services/nomina/turno.service';
import { ITipoTurnoService } from '../../ports/nomina/service_port/turno.service.interface';
import { TipoTurnoService } from '../../services/nomina/turno.service';

// --- Original: turno ---
export class TurnoController {
    private service: ITurnoService;

    constructor() {
        this.service = new TurnoService();
    }

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

// --- Original: tipo_turno ---
export class TipoTurnoController {
    private service: ITipoTurnoService;

    constructor() {
        this.service = new TipoTurnoService();
    }

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