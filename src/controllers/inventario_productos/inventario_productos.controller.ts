import { Request, Response } from 'express';
import { IProductoService, IMovimientoService, IResumenInventarioService } from '../../ports/inventario_productos/service_port/inventario_productos.service.interface';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

// GET /inventario-productos/productos?categoria=&q=&bajo_minimo=&limit=&offset=
// POST/PUT/DELETE /inventario-productos/productos/:id
export class ProductoController {
    constructor(private service: IProductoService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.create(req.body);
            res.status(201).json({ success: true, data });
        } catch (e: any) { fail(res, e); }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const { categoria, q, bajo_minimo, limit, offset } = req.query as any;
            const data = await this.service.list({ categoria, q, bajo_minimo, limit, offset });
            res.status(200).json({ success: true, data });
        } catch (e: any) { fail(res, e); }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.getById(Number(req.params.id));
            if (!data) { fail(res, AppError.http(404, 'Producto no encontrado')); return; }
            res.status(200).json({ success: true, data });
        } catch (e: any) { fail(res, e); }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.update(Number(req.params.id), req.body);
            res.status(200).json({ success: true, data });
        } catch (e: any) { fail(res, e); }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const deleted = await this.service.delete(Number(req.params.id));
            if (!deleted) { fail(res, AppError.http(404, 'Producto no encontrado')); return; }
            res.status(200).json({ success: true, message: 'Producto eliminado' });
        } catch (e: any) { fail(res, e); }
    };
}

// GET /inventario-productos/movimientos?id_producto=&tipo=&desde=&hasta=&limit=&offset=
// POST /inventario-productos/movimientos  { id_producto, fecha, tipo, cantidad, costo_unitario?, nota? }
// DELETE /inventario-productos/movimientos/:id
export class MovimientoController {
    constructor(private service: IMovimientoService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.create(req.body);
            res.status(201).json({ success: true, data });
        } catch (e: any) { fail(res, e); }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_producto, tipo, desde, hasta, limit, offset } = req.query as any;
            const data = await this.service.list({ id_producto, tipo, desde, hasta, limit, offset });
            res.status(200).json({ success: true, data });
        } catch (e: any) { fail(res, e); }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const deleted = await this.service.delete(Number(req.params.id));
            if (!deleted) { fail(res, AppError.http(404, 'Movimiento no encontrado')); return; }
            res.status(200).json({ success: true, message: 'Movimiento eliminado' });
        } catch (e: any) { fail(res, e); }
    };
}

// GET /inventario-productos/resumen?desde=&hasta=
export class ResumenInventarioController {
    constructor(private service: IResumenInventarioService) {}

    resumen = async (req: Request, res: Response): Promise<void> => {
        try {
            const { desde, hasta } = req.query as any;
            const data = await this.service.resumen({ desde, hasta });
            res.status(200).json({ success: true, data });
        } catch (e: any) { fail(res, e); }
    };
}
