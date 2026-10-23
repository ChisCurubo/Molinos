import { Request, Response } from 'express';
import { ICategoriaCxCService, ICuentasPorCobrarService } from '../../ports/pagos/service_port/cxc.service.interface';
import { CategoriaCxCService } from '../../services/pagos/cxc.service';

// --- Original: categoria_cxc ---
export class CategoriaCxCController {
    constructor(private service: ICategoriaCxCService) {}

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

// --- Cuentas_Por_Cobrar ---
export class CuentasPorCobrarController {
    constructor(private service: ICuentasPorCobrarService) {}

    // GET /pagos/cxc/mensual?mes=&anio=&id_categoria=&estado=&page=&limit=
    listarMensual = async (req: Request, res: Response): Promise<void> => {
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
            res.status(400).json({ success: false, message: error.message });
        }
    };

    // POST /pagos/cxc — crea la cuenta por cobrar (sin abono, o con `abono` inicial incluido)
    crear = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.crear(req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    // GET /pagos/cxc/:id
    obtenerPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.obtenerPorId(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    // POST /pagos/cxc/:id/abonos — cobro sobre una cuenta ya creada
    abonar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.abonar(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    // PATCH /pagos/cxc/:id — corrige concepto/categoría/valor_total/fechas/deudor
    editar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.editar(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    // DELETE /pagos/cxc/:id — anula (borrado lógico)
    anular = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.service.anular(Number(req.params.id));
            res.status(200).json({ success: true });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };
}