import { Request, Response } from 'express';
import { ConcentradoService } from '../../services/material/concentrado.service';

export class ConcentradoController {
    constructor(private concentradoService: ConcentradoService) {}

    // --- LECTURA -------------------------------------------------------------

    // GET /material/concentrado — listar lotes (todos los estados) con filtros.
    public listar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.concentradoService.listarLotes(req.query);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/concentrado/resumen — KPIs por estado.
    public resumen = async (_req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.concentradoService.resumenProcesamiento();
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/concentrado/procesamiento — materiales vinculados a lotes (lista plana).
    public listarProcesamiento = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.concentradoService.listarProcesamiento(req.query);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    // GET /material/concentrado/:id — detalle del lote + materiales + análisis.
    public obtenerDetalle = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            const data = await this.concentradoService.obtenerLoteDetalle(id);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, error: error.message });
        }
    };

    public iniciarLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = await this.concentradoService.iniciarLote(req.body);
            res.status(201).json({ success: true, message: 'Lote iniciado', id });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public procesarMaterial = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLote = parseInt(req.params.id as string);
            const { id_entradas, toneladas_procesadas_seco } = req.body;

            if (!id_entradas || !Array.isArray(id_entradas) || id_entradas.length === 0) {
                res.status(400).json({ success: false, message: 'Se requiere un arreglo de id_entradas' });
                return;
            }
            if (!toneladas_procesadas_seco || toneladas_procesadas_seco <= 0) {
                res.status(400).json({ success: false, message: 'Se requiere toneladas_procesadas_seco válido' });
                return;
            }

            const result = await this.concentradoService.procesarLote(idLote, id_entradas, toneladas_procesadas_seco);
            res.status(201).json({ success: true, message: 'Material procesado correctamente', data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public cerrarLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            await this.concentradoService.cerrarLoteConcentradoTx(id, req.body);
            res.status(200).json({ success: true, message: 'Lote cerrado y enviado a canoa' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    public editarLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            await this.concentradoService.editarLote(id, req.body);
            res.status(200).json({ success: true, message: 'Lote actualizado' });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, message: error.message });
        }
    };

    public desvincularMaterial = async (req: Request, res: Response): Promise<void> => {
        try {
            const idLote = parseInt(req.params.id as string);
            const idEntrada = parseInt(req.params.idEntrada as string);
            await this.concentradoService.desvincularMaterialTx(idLote, idEntrada);
            res.status(200).json({ success: true, message: 'Material desvinculado (stock devuelto al inventario)' });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, message: error.message });
        }
    };

    public eliminarLote = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string);
            await this.concentradoService.eliminarLoteTx(id);
            res.status(200).json({ success: true, message: 'Lote eliminado (material devuelto al inventario)' });
        } catch (error: any) {
            res.status(error.status || 500).json({ success: false, message: error.message });
        }
    };
}
