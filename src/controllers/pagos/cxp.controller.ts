import { Request, Response } from 'express';
import { CuentasPorPagarServiceInterface } from '../../ports/pagos/service_port/cxp.service.interface';
import { ICategoriaCxPService } from '../../ports/pagos/service_port/cxp.service.interface';
import { CategoriaCxPService } from '../../services/pagos/cxp.service';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

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
            fail(res, error, 400);
        }
    }

    async listar(req: Request, res: Response) {
        try {
            const cuentas = await this.service.listarCuentas();
            res.status(200).json({ success: true, data: cuentas });
        } catch (error: any) {
            fail(res, error);
        }
    }

    // GET /pagos/cxp/mensual?mes=&anio=&id_categoria=&estado=&page=&limit=
    async listarMensual(req: Request, res: Response) {
        try {
            const { mes, anio, id_categoria, estado, page, limit } = req.query as any;
            const data = await this.service.listarPaginado({
                mes: mes ? Number(mes) : undefined,
                anio: anio ? Number(anio) : undefined,
                id_categoria: id_categoria ? Number(id_categoria) : undefined,
                estado: estado || undefined,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            fail(res, error, 400);
        }
    }

    async abonar(req: Request, res: Response) {
        try {
            const data = await this.service.registrarAbono(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            fail(res, error, 400);
        }
    }

    async pagar(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { pagoAdicional } = req.body;
            const success = await this.service.actualizarEstadoPago(Number(id), Number(pagoAdicional));
            res.status(200).json({ success, message: 'Pago actualizado' });
        } catch (error: any) {
            fail(res, error, 400);
        }
    }
}

// --- Original: categoria_cxp ---
export class CategoriaCxPController {
    constructor(private service: ICategoriaCxPService) {}

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