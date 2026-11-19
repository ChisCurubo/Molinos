import { Request, Response } from 'express';
import { ICategoriaProveedorService, IProveedorService } from '../../ports/pagos/service_port/proveedor.service.interface';
import { CategoriaProveedorService } from '../../services/pagos/proveedor.service';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

// --- Original: categoria_proveedor ---
export class CategoriaProveedorController {
    constructor(private service: ICategoriaProveedorService) {}

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

// --- Proveedores (la entidad real: transportadoras de mula, laboratorios, gasolineras, etc.) ---
export class ProveedorController {
    constructor(private service: IProveedorService) {}

    private fail(res: Response, error: any) {
        fail(res, error, 400);
    }

    // POST /pagos/proveedores  { nombre, id_categoria?, tipo?, contacto?, telefono?, ciudad?, alias?, nequi?, compra_realizada?, estado? }
    // tipo: 'general' (default) | 'combustible' | 'transportadora' | 'laboratorio'
    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.create(req.body);
            res.status(201).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // GET /pagos/proveedores?id_categoria=&tipo=&estado=&q=
    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_categoria, tipo, estado, q } = req.query as any;
            const data = await this.service.list({
                id_categoria: id_categoria ? Number(id_categoria) : undefined,
                tipo: tipo || undefined,
                estado: estado || undefined,
                q: q || undefined
            });
            res.status(200).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // GET /pagos/proveedores/:id
    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.getById(Number(req.params.id));
            if (!data) { fail(res, AppError.http(404, 'Proveedor no encontrado')); return; }
            res.status(200).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // PUT /pagos/proveedores/:id
    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.update(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // DELETE /pagos/proveedores/:id
    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const deleted = await this.service.delete(Number(req.params.id));
            if (!deleted) { fail(res, AppError.http(404, 'Proveedor no encontrado')); return; }
            res.status(200).json({ success: true, message: 'Proveedor eliminado' });
        } catch (e: any) { this.fail(res, e); }
    };
}