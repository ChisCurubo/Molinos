import { Request, Response } from 'express';

export class MinaController {
  public listar = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json({ success: true, data: [] });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Error interno', error: error.message });
    }
  };
}
