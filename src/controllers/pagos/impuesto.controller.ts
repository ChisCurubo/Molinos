import { Request, Response } from 'express';
import { IImpuestoService } from '../../ports/pagos/service_port/impuesto.service.interface';
import { fail } from '../../errors/responder';

export class ImpuestoController {
    constructor(private service: IImpuestoService) {}

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const impuestos = await this.service.list();
            res.status(200).json({ success: true, data: impuestos });
        } catch (error: any) {
            fail(res, error);
        }
    };

    listarAplicados = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_cuenta_bancaria, desde, hasta } = req.query as any;
            const aplicados = await this.service.listarAplicados({
                id_cuenta_bancaria: id_cuenta_bancaria ? Number(id_cuenta_bancaria) : undefined,
                desde, hasta
            });
            res.status(200).json({ success: true, data: aplicados });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
