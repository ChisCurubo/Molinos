import { Request, Response } from 'express';
import { IJornadaNocturnaLegalService } from '../../ports/nomina/service_port/jornada_nocturna_legal.service.interface';

export class JornadaNocturnaLegalController {
    constructor(private service: IJornadaNocturnaLegalService) {}

    listar = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.listar();
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    crear = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.crearVigencia(req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };
}
