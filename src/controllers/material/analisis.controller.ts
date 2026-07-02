import { Request, Response } from 'express';
import { AnalisisService } from '../../services/material/analisis.service';
import { CreateAnalisisDTO } from '../../models/material/sql/analisis.sql';

export class AnalisisController {
  private analisisService = new AnalisisService();

  public registrarAnalisis = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: CreateAnalisisDTO = req.body;
      // Validaciones básicas
      if (!data.id_entrada || !data.id_tipo_analisis || data.porcentaje_humedad === undefined || data.toneladas_secas === undefined || data.au_gr_x_ton_falso === undefined) {
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

  public obtenerAnalisis = async (req: Request, res: Response): Promise<void> => {
      try {
          const { id_entrada } = req.params;
          const data = await this.analisisService.obtenerTodosPorEntrada(Number(id_entrada));
          res.status(200).json({ success: true, data });
      } catch (error: any) {
          res.status(500).json({ success: false, message: 'Error interno.', error: error.message });
      }
  };
}

