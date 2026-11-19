import { Request, Response } from 'express';
import { IDuenoVolquetaService } from '../../ports/material/service_port/volqueta.service.interface';
import { DuenoVolquetaService } from '../../services/material/volqueta.service';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

// --- Original: dueno_volqueta ---
export class DuenoVolquetaController {
    private service: IDuenoVolquetaService;

    constructor(service: IDuenoVolquetaService) {
        this.service = service;
    }

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