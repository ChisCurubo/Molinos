import { Request, Response } from 'express';
import { CuentasPorPagarServiceInterface } from '../../ports/pagos/service_port/cxp.service.interface';
import { ICategoriaCxPService } from '../../ports/pagos/service_port/cxp.service.interface';
import { CategoriaCxPService } from '../../services/pagos/cxp.service';

// --- Original: cuentas_por_pagar ---
export class CuentasPorPagarController {
    private service: CuentasPorPagarServiceInterface;

    constructor(service: CuentasPorPagarServiceInterface) {
        this.service = service;
    }

    async registrar(req: Request, res: Response) {
        try {
            const cuenta = await this.service.registrarCuenta(req.body);
            res.status(201).json({ success: true, data: cuenta });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async listar(req: Request, res: Response) {
        try {
            const cuentas = await this.service.listarCuentas();
            res.status(200).json({ success: true, data: cuentas });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async pagar(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { pagoAdicional } = req.body;
            const success = await this.service.actualizarEstadoPago(Number(id), Number(pagoAdicional));
            res.status(200).json({ success, message: 'Pago actualizado' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}

// --- Original: categoria_cxp ---
export class CategoriaCxPController {
    private service: ICategoriaCxPService;

    constructor() {
        this.service = new CategoriaCxPService();
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