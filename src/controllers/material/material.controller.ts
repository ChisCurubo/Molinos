import { Request, Response } from 'express';
import { IMaterialEntradaService, ITipoMaterialService, IPrecioMaterialService, ITarifaCalculoService, IProveedorService, IMinaService } from '../../ports/material/service_port/material.service.interface';
import { MaterialEntradaService, TipoMaterialService, PrecioMaterialService, TarifaCalculoService, ProveedorService, MinaService } from '../../services/material/material.service';
import { CreateMaterialEntradaDTO } from '../../models/material/sql/material_planta_entrada.sql';
import { CreateAnalisisDTO } from '../../models/material/sql/analisis.sql';

export class MaterialEntradaController {
    private service: IMaterialEntradaService;

    constructor() {
        this.service = new MaterialEntradaService();
    }

    public registrarLlegada = async (req: Request, res: Response): Promise<void> => {
        try {
            const data: CreateMaterialEntradaDTO = req.body;
            if (!data.numero_volqueta || !data.id_mina || !data.id_tipo_material || !data.peso_llegada_planta) {
                res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
                return;
            }
            const id = await this.service.registrarLlegada(data);
            res.status(201).json({ success: true, message: 'Entrada registrada', id });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };


    public listarEntradas = async (req: Request, res: Response): Promise<void> => {
        try {
            const { fechaDesde, fechaHasta, estado, limit, offset } = req.query;
            const entradas = await this.service.listarEntradas(
                (fechaDesde as string) || '2000-01-01',
                (fechaHasta as string) || '2100-01-01',
                (estado as string) || '',
                limit ? parseInt(limit as string) : 100,
                offset ? parseInt(offset as string) : 0
            );
            res.status(200).json({ success: true, data: entradas });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error al listar', error: error.message });
        }
    };

    public pendientesLaboratorio = async (req: Request, res: Response): Promise<void> => {
        try {
            const entradas = await this.service.listarPendientesLaboratorio();
            res.status(200).json({ success: true, data: entradas });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error al listar pendientes', error: error.message });
        }
    };
}

export class TipoMaterialController {
    private service: ITipoMaterialService = new TipoMaterialService();
    // basic CRUD implementation...
}

export class PrecioMaterialController {
    private service: IPrecioMaterialService = new PrecioMaterialService();
    
    public buscarPrecio = async (req: Request, res: Response): Promise<void> => {
        try {
            const { idMinero, idZona, metodo, tenorFalso, fechaEntrada } = req.query;
            if (!metodo || !tenorFalso || !fechaEntrada) {
                res.status(400).json({ success: false, message: 'Faltan parámetros: metodo, tenorFalso, fechaEntrada' });
                return;
            }
            const precio = await this.service.buscarPrecio(
                idMinero ? Number(idMinero) : null,
                idZona ? Number(idZona) : null,
                metodo as string,
                Number(tenorFalso),
                fechaEntrada as string
            );
            res.status(200).json({ success: true, data: precio });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };
}

export class TarifaCalculoController {
    private service: ITarifaCalculoService = new TarifaCalculoService();
    // basic CRUD implementation...
}

export class ProveedorController {
    private service: IProveedorService = new ProveedorService();
    // basic CRUD implementation...
}

export class MinaController {
    private service: IMinaService = new MinaService();
    // basic CRUD implementation...
}