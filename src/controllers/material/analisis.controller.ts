import { Request, Response } from 'express';
import { IAnalisisService } from '../../ports/material/service_port/analisis.service.interface';
import { CreateAnalisisDTO } from '../../models/material/sql/analisis.sql';

import { IAnalisisRepository } from '../../ports/material/repository_port/analisis.repository.interface';

export class AnalisisController {
  private analisisService: IAnalisisService;
  private repo: IAnalisisRepository;

  constructor(analisisService: IAnalisisService, repo: IAnalisisRepository) {
    this.analisisService = analisisService;
    this.repo = repo;
  }

  public registrarAnalisis = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: CreateAnalisisDTO = req.body;
      if (!data.id_entrada || !data.numero_analisis || data.toneladas === undefined || data.porcentaje_humedad === undefined || data.au_concentrado === undefined || data.au_falso === undefined || data.ag_concentrado === undefined) {
        res.status(400).json({ success: false, message: 'Faltan campos obligatorios para el análisis.' });
        return;
      }

      await this.analisisService.vincularAnalisisAEntrada(data);
      
      res.status(201).json({
        success: true,
        message: 'Análisis registrado exitosamente y cálculos de material actualizados (Fases 2 a 5).'
      });
    } catch (error: any) {
      console.error('Error al registrar análisis:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor al procesar el análisis.', error: error.message });
    }
  };

  // POST /material/analisis/cabeza — alias de conveniencia para el análisis de Cabeza (tipo 1).
  // Reutiliza la lógica transaccional de vincularAnalisisAEntrada; numero_analisis se
  // autogenera como "AN-{numero_volqueta}" si se envía vacío.
  public registrarCabeza = async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body;
      if (!b.id_entrada || b.porcentaje_humedad === undefined || b.au_concentrado === undefined) {
        res.status(400).json({ success: false, message: 'Faltan campos obligatorios: id_entrada, porcentaje_humedad, au_concentrado' });
        return;
      }
      const data: CreateAnalisisDTO = {
        id_entrada: Number(b.id_entrada),
        id_tipo_analisis: 1,
        numero_analisis: b.numero_analisis ?? '',
        id_laboratorio: b.id_laboratorio ?? undefined,
        toneladas: b.toneladas,
        porcentaje_humedad: Number(b.porcentaje_humedad),
        au_concentrado: Number(b.au_concentrado),
        ag_concentrado: b.ag_concentrado !== undefined ? Number(b.ag_concentrado) : 0,
        au_falso: b.au_falso !== undefined ? Number(b.au_falso) : 0,
        comentarios: b.comentarios ?? undefined
      };
      await this.analisisService.vincularAnalisisAEntrada(data);
      res.status(201).json({ success: true, message: 'Análisis de cabeza registrado y cálculos de material actualizados.' });
    } catch (e: any) {
      res.status(e?.status || 500).json({ success: false, error: e.message || String(e), ...(e?.code && { code: e.code }) });
    }
  };

  // DELETE /material/analisis/:id — bloquea con 409 si la entrada está en_proceso/incluida_viaje.
  public eliminar = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.analisisService.eliminarAnalisis(Number(req.params.id));
      res.status(200).json({ success: true, message: 'Análisis eliminado' });
    } catch (e: any) {
      res.status(e?.status || 500).json({ success: false, error: e.message || String(e), ...(e?.code && { code: e.code }) });
    }
  };

  public obtenerAnalisis = async (req: Request, res: Response): Promise<void> => {
      try {
          const { id_entrada } = req.params;
          const data = await this.analisisService.obtenerTodosPorEntrada(Number(id_entrada));
          res.status(200).json({ success: true, data });
      } catch (error: any) {
          res.status(500).json({ success: false, message: 'Error interno.', error: error.message });
      }
  };

  // GET /material/analisis?id_entrada=X — variante por query string.
  public obtenerPorQuery = async (req: Request, res: Response): Promise<void> => {
      try {
          const idEntrada = req.query.id_entrada;
          if (!idEntrada) {
              res.status(400).json({ success: false, message: 'id_entrada es requerido' });
              return;
          }
          const data = await this.analisisService.obtenerTodosPorEntrada(Number(idEntrada));
          res.status(200).json({ success: true, data });
      } catch (error: any) {
          res.status(500).json({ success: false, message: 'Error interno.', error: error.message });
      }
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.repo.obtenerPorId(Number(req.params.id));
      if (!data) { res.status(404).json({ success: false, error: 'Análisis no encontrado' }); return; }
      res.status(200).json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };

  public obtenerCabeza = async (req: Request, res: Response): Promise<void> => {
      try {
          const data = await this.repo.obtenerCabezaPorEntrada(Number(req.params.id_entrada));
          if (!data) { res.status(404).json({ success: false, error: 'No hay análisis Cabeza para esta entrada' }); return; }
          res.status(200).json({ success: true, data });
      } catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };

  public actualizarAnalisis = async (req: Request, res: Response): Promise<void> => {
    try {
      const identificador = String(req.params.id);
      if (!req.params.id) { res.status(400).json({ success: false, message: 'Identificador de análisis inválido' }); return; }
      await this.analisisService.actualizarAnalisis(identificador, req.body);
      res.status(200).json({ success: true, message: 'Análisis actualizado exitosamente' });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };

  public agregarValor = async (req: Request, res: Response): Promise<void> => {
    try {
      const identificador = String(req.params.id);
      const valor = req.body.valor_analisis;
      if (!req.params.id || valor === undefined) { 
          res.status(400).json({ success: false, message: 'Faltan campos: id/numero_analisis o valor_analisis' }); return; 
      }
      await this.analisisService.agregarValorAnalisis(identificador, Number(valor));
      res.status(200).json({ success: true, message: 'Valor del análisis actualizado exitosamente' });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };

  public listarPorMinero = async (req: Request, res: Response): Promise<void> => {
      try { res.status(200).json({ success: true, data: await this.repo.listarPorMinero(Number(req.params.id_minero)) }); } 
      catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };

  public listarPorMina = async (req: Request, res: Response): Promise<void> => {
      try { res.status(200).json({ success: true, data: await this.repo.listarPorMina(Number(req.params.id_mina)) }); } 
      catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };

  public listarPorFecha = async (req: Request, res: Response): Promise<void> => {
      try { res.status(200).json({ success: true, data: await this.repo.listarPorFecha(String(req.params.fecha)) }); } 
      catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };



  public marcarPago = async (req: Request, res: Response): Promise<void> => {
      try {
          await this.repo.actualizarEstadoPago(Number(req.params.id), req.body.estado);
          res.status(200).json({ success: true, data: { updated: true } });
      } catch (e: any) { res.status(500).json({ success: false, error: e.message || String(e) }); }
  };
}

