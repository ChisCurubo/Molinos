import { Request, Response } from 'express';
import { ICombustibleService } from '../../ports/pagos/service_port/combustible.service.interface';

const TIPOS_CONSUMO = ['vehiculo', 'planta', 'maquinaria', 'otro'];
const FORMAS_PAGO = ['efectivo', 'credito'];

export class CombustibleController {
    constructor(private service: ICombustibleService) {}

    // POST /pagos/combustible — registro manual de un tanqueo/suministro.
    public registrar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id_gasolinera, tipo_consumo, forma_pago, id_dueno_volqueta, id_vehiculo, id_planta, fecha, descripcion, valor, comprobante_url } = req.body;
            const tipo = tipo_consumo || 'vehiculo';
            const forma = forma_pago || 'credito';
            if (!TIPOS_CONSUMO.includes(tipo)) {
                res.status(400).json({ success: false, message: `tipo_consumo inválido. Use uno de: ${TIPOS_CONSUMO.join(', ')}` });
                return;
            }
            if (!FORMAS_PAGO.includes(forma)) {
                res.status(400).json({ success: false, message: `forma_pago inválida. Use uno de: ${FORMAS_PAGO.join(', ')}` });
                return;
            }
            if (tipo === 'vehiculo' && !id_vehiculo && !id_dueno_volqueta) {
                res.status(400).json({ success: false, message: 'Para tipo_consumo=vehiculo se requiere id_vehiculo o id_dueno_volqueta' });
                return;
            }
            if (forma === 'credito' && !id_gasolinera) {
                res.status(400).json({ success: false, message: 'Para forma_pago=credito se requiere id_gasolinera (es a quien se le arma la cuenta por pagar)' });
                return;
            }
            if (!fecha || !valor) {
                res.status(400).json({ success: false, message: 'fecha y valor son obligatorios' });
                return;
            }
            const data = await this.service.registrar({
                id_gasolinera: id_gasolinera ?? null,
                tipo_consumo: tipo,
                forma_pago: forma,
                id_dueno_volqueta: id_dueno_volqueta ?? null,
                id_vehiculo: id_vehiculo ?? null,
                id_planta: id_planta ?? null,
                fecha,
                descripcion: descripcion ?? null,
                valor,
                comprobante_url: comprobante_url ?? null
            });
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    };

    // PUT /pagos/combustible/:id
    public editar = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = Number(req.params.id);
            if (!id) {
                res.status(400).json({ success: false, message: 'ID inválido' });
                return;
            }
            if (req.body.tipo_consumo && !TIPOS_CONSUMO.includes(req.body.tipo_consumo)) {
                res.status(400).json({ success: false, message: `tipo_consumo inválido. Use uno de: ${TIPOS_CONSUMO.join(', ')}` });
                return;
            }
            if (req.body.forma_pago && !FORMAS_PAGO.includes(req.body.forma_pago)) {
                res.status(400).json({ success: false, message: `forma_pago inválida. Use uno de: ${FORMAS_PAGO.join(', ')}` });
                return;
            }
            const data = await this.service.actualizar(id, req.body);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    // DELETE /pagos/combustible/:id
    public eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = Number(req.params.id);
            if (!id) {
                res.status(400).json({ success: false, message: 'ID inválido' });
                return;
            }
            await this.service.eliminar(id);
            res.status(200).json({ success: true, message: 'Registro de combustible eliminado' });
        } catch (error: any) {
            res.status(error?.status || 400).json({ success: false, message: error.message });
        }
    };

    // GET /pagos/combustible  — lista de consumos/adelantos de combustible (ACPM).
    // Filtros: ?desde&hasta, ?id_gasolinera, ?id_dueno_volqueta, ?tipo_consumo
    public listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const { desde, hasta, id_gasolinera, id_dueno_volqueta, tipo_consumo, forma_pago } = req.query as any;
            const data = await this.service.listar({
                desde: desde || undefined,
                hasta: hasta || undefined,
                id_gasolinera: id_gasolinera ? Number(id_gasolinera) : undefined,
                id_dueno_volqueta: id_dueno_volqueta ? Number(id_dueno_volqueta) : undefined,
                tipo_consumo: tipo_consumo || undefined,
                forma_pago: forma_pago || undefined
            });
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    // GET /pagos/combustible/resumen-mensual — total por mes, con desglose por forma_pago y tipo_consumo.
    // Filtros: ?anio, ?forma_pago, ?tipo_consumo
    public resumenMensual = async (req: Request, res: Response): Promise<void> => {
        try {
            const { anio, forma_pago, tipo_consumo } = req.query as any;
            const data = await this.service.resumenMensual({
                anio: anio ? Number(anio) : undefined,
                forma_pago: forma_pago || undefined,
                tipo_consumo: tipo_consumo || undefined
            });
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    // GET /pagos/combustible/kpis — dashboard: mes actual vs anterior, promedio, histórico, top gasolineras/dueños.
    public kpis = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.kpis();
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    // GET /pagos/combustible/dueno/:id/neto-flete — flete neto del dueño con arrastre de ACPM.
    public netoFletePorDueno = async (req: Request, res: Response): Promise<void> => {
        try {
            const idDueno = Number(req.params.id);
            if (!idDueno) {
                res.status(400).json({ success: false, message: 'ID de dueño inválido' });
                return;
            }
            const data = await this.service.calcularNetoFletePorDueno(idDueno);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };

    // GET /pagos/combustible/:id
    public obtener = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = Number(req.params.id);
            if (!id) {
                res.status(400).json({ success: false, message: 'ID inválido' });
                return;
            }
            const data = await this.service.obtenerPorId(id);
            if (!data) {
                res.status(404).json({ success: false, message: 'Registro de combustible no encontrado' });
                return;
            }
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Error interno', error: error.message });
        }
    };
}
