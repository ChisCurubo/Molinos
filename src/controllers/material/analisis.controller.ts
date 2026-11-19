import { Request, Response } from 'express';
import { IAnalisisService } from '../../ports/material/service_port/analisis.service.interface';
import { CreateAnalisisDTO } from '../../models/material/sql/analisis.sql';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class AnalisisController {
  private analisisService: IAnalisisService;

  constructor(analisisService: IAnalisisService) {
    this.analisisService = analisisService;
  }

  public registrarAnalisis = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: CreateAnalisisDTO = req.body;

      // CASO CONCENTRADO (tipo 2): análisis del LOTE. Solo requiere humedad + au + nombre;
      // la tonelada base y los tenores se calculan sobre el lote (toneladas_seco del cierre).
      if (data.id_material_concentrado) {
        data.id_tipo_analisis = 2;
        if (data.porcentaje_humedad === undefined || data.au_concentrado === undefined) {
          fail(res, AppError.http(400, 'Faltan campos obligatorios: porcentaje_humedad, au_concentrado (análisis de concentrado).'));
          return;
        }
        if (!data.numero_analisis) data.numero_analisis = `AN-LOTE-${data.id_material_concentrado}`;
        if (data.ag_concentrado === undefined) data.ag_concentrado = 0;
        if (data.au_falso === undefined) data.au_falso = 0;

        await this.analisisService.vincularAnalisisAEntrada(data);
        res.status(201).json({ success: true, message: 'Análisis de concentrado registrado y vinculado al lote.' });
        return;
      }

      // CASO ENTRADA (tipo cabeza / crudo)
      if (!data.id_entrada || !data.numero_analisis || data.toneladas === undefined || data.porcentaje_humedad === undefined || data.au_concentrado === undefined || data.au_falso === undefined || data.ag_concentrado === undefined) {
        fail(res, AppError.http(400, 'Faltan campos obligatorios para el análisis.'));
        return;
      }

      await this.analisisService.vincularAnalisisAEntrada(data);

      res.status(201).json({
        success: true,
        message: 'Análisis registrado exitosamente y cálculos de material actualizados (Fases 2 a 5).'
      });
    } catch (error: any) {
      console.error('Error al registrar análisis:', error);
      fail(res, error);
    }
  };

  // POST /material/analisis/cabeza — alias de conveniencia para el análisis de Cabeza (tipo 1).
  // Reutiliza la lógica transaccional de vincularAnalisisAEntrada; numero_analisis se
  // autogenera como "AN-{numero_volqueta}" si se envía vacío.
  public registrarCabeza = async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body;
      if (!b.id_entrada || b.porcentaje_humedad === undefined || b.au_concentrado === undefined) {
        fail(res, AppError.http(400, 'Faltan campos obligatorios: id_entrada, porcentaje_humedad, au_concentrado'));
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
      fail(res, e);
    }
  };

  // DELETE /material/analisis/:id — bloquea con 409 si la entrada está en_proceso/incluida_viaje.
  public eliminar = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.analisisService.eliminarAnalisis(Number(req.params.id));
      res.status(200).json({ success: true, message: 'Análisis eliminado' });
    } catch (e: any) {
      fail(res, e);
    }
  };

  public obtenerAnalisis = async (req: Request, res: Response): Promise<void> => {
      try {
          const { id_entrada } = req.params;
          const data = await this.analisisService.obtenerTodosPorEntrada(Number(id_entrada));
          res.status(200).json({ success: true, data });
      } catch (error: any) {
          fail(res, error);
      }
  };

  // GET /material/analisis?id_entrada=X — variante por query string.
  public obtenerPorQuery = async (req: Request, res: Response): Promise<void> => {
      try {
          const idEntrada = req.query.id_entrada;
          if (!idEntrada) {
              fail(res, AppError.http(400, 'id_entrada es requerido'));
              return;
          }
          const data = await this.analisisService.obtenerTodosPorEntrada(Number(idEntrada));
          res.status(200).json({ success: true, data });
      } catch (error: any) {
          fail(res, error);
      }
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.analisisService.obtenerPorId(Number(req.params.id));
      if (!data) { fail(res, AppError.http(404, 'Análisis no encontrado')); return; }
      res.status(200).json({ success: true, data });
    } catch (e: any) { fail(res, e); }
  };

  public obtenerCabeza = async (req: Request, res: Response): Promise<void> => {
      try {
          const data = await this.analisisService.obtenerCabezaPorEntrada(Number(req.params.id_entrada));
          if (!data) { fail(res, AppError.http(404, 'No hay análisis Cabeza para esta entrada')); return; }
          res.status(200).json({ success: true, data });
      } catch (e: any) { fail(res, e); }
  };

  public actualizarAnalisis = async (req: Request, res: Response): Promise<void> => {
    try {
      const identificador = String(req.params.id);
      if (!req.params.id) { fail(res, AppError.http(400, 'Identificador de análisis inválido')); return; }
      await this.analisisService.actualizarAnalisis(identificador, req.body);
      res.status(200).json({ success: true, message: 'Análisis actualizado exitosamente' });
    } catch (e: any) { fail(res, e); }
  };

  public agregarValor = async (req: Request, res: Response): Promise<void> => {
    try {
      const identificador = String(req.params.id);
      const valor = req.body.valor_analisis;
      if (!req.params.id || valor === undefined) { 
          fail(res, AppError.http(400, 'Faltan campos: id/numero_analisis o valor_analisis')); return; 
      }
      await this.analisisService.agregarValorAnalisis(identificador, Number(valor));
      res.status(200).json({ success: true, message: 'Valor del análisis actualizado exitosamente' });
    } catch (e: any) { fail(res, e); }
  };

  public listarPorMinero = async (req: Request, res: Response): Promise<void> => {
      try { res.status(200).json({ success: true, data: await this.analisisService.listarPorMinero(Number(req.params.id_minero)) }); }
      catch (e: any) { fail(res, e); }
  };

  public listarPorMina = async (req: Request, res: Response): Promise<void> => {
      try { res.status(200).json({ success: true, data: await this.analisisService.listarPorMina(Number(req.params.id_mina)) }); }
      catch (e: any) { fail(res, e); }
  };

  public listarPorFecha = async (req: Request, res: Response): Promise<void> => {
      try { res.status(200).json({ success: true, data: await this.analisisService.listarPorFecha(String(req.params.fecha)) }); }
      catch (e: any) { fail(res, e); }
  };

  // GET /material/analisis/concentrado/:id_lote — análisis del concentrado de un lote.
  public obtenerPorConcentrado = async (req: Request, res: Response): Promise<void> => {
      try { res.status(200).json({ success: true, data: await this.analisisService.obtenerAnalisisDeConcentrado(Number(req.params.id_lote)) }); }
      catch (e: any) { fail(res, e); }
  };



  public marcarPago = async (req: Request, res: Response): Promise<void> => {
      try {
          await this.analisisService.actualizarEstadoPago(Number(req.params.id), req.body.estado);
          res.status(200).json({ success: true, data: { updated: true } });
      } catch (e: any) { fail(res, e); }
  };
}

