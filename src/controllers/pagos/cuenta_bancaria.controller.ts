import { Request, Response } from 'express';
import { ICuentaBancariaService } from '../../ports/pagos/service_port/cuenta_bancaria.service.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class CuentaBancariaController {
    constructor(private service: ICuentaBancariaService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.create(req.body);
            res.status(201).json({ success: true, data: cuenta });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.getById(Number(req.params.id));
            if (!cuenta) { fail(res, AppError.http(404, 'Cuenta bancaria no encontrada')); return; }
            res.status(200).json({ success: true, data: cuenta });
        } catch (error: any) {
            fail(res, error);
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuenta = await this.service.update(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data: cuenta });
        } catch (error: any) {
            fail(res, error);
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.delete(Number(req.params.id));
            res.status(200).json({ success: true, message: 'Cuenta bancaria eliminada' });
        } catch (error: any) {
            fail(res, error);
        }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const cuentas = await this.service.list();
            res.status(200).json({ success: true, data: cuentas });
        } catch (error: any) {
            fail(res, error);
        }
    };

    getSaldo = async (req: Request, res: Response): Promise<void> => {
        try {
            const saldo = await this.service.getSaldo(Number(req.params.id));
            res.status(200).json({ success: true, data: saldo });
        } catch (error: any) {
            fail(res, error);
        }
    };

    listarSaldos = async (req: Request, res: Response): Promise<void> => {
        try {
            const saldos = await this.service.listarSaldos();
            res.status(200).json({ success: true, data: saldos });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
