import { Request, Response } from 'express';
import { EmpleadoFichaService } from '../../services/nomina/empleado_ficha.service';
import { fail } from '../../errors/responder';

export class EmpleadoFichaController {
    constructor(private service: EmpleadoFichaService) {}

    obtener = async (req: Request, res: Response): Promise<void> => {
        try {
            const anio = req.query.anio ? Number(req.query.anio) : undefined;
            const ficha = await this.service.obtenerFicha(Number(req.params.id), anio);
            res.status(200).json({ success: true, data: ficha });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
