import { Request, Response } from 'express';
import { IUsuarioService } from '../../ports/auth/service_port/usuario.service.interface';
import { UsuarioService } from '../../services/auth/usuario.service';

export class UsuarioController {
    constructor(private usuarioService: IUsuarioService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const usuario = await this.usuarioService.create(req.body);
            res.status(201).json({ success: true, data: usuario });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const usuario = await this.usuarioService.getById(id);
            if (!usuario) {
                res.status(404).json({ success: false, error: 'Usuario no encontrado' });
                return;
            }
            res.status(200).json({ success: true, data: usuario });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const usuario = await this.usuarioService.update(id, req.body);
            if (!usuario) {
                res.status(404).json({ success: false, error: 'Usuario no encontrado o sin cambios' });
                return;
            }
            res.status(200).json({ success: true, data: usuario });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const deleted = await this.usuarioService.delete(id);
            if (!deleted) {
                res.status(404).json({ success: false, error: 'Usuario no encontrado' });
                return;
            }
            res.status(200).json({ success: true, message: 'Usuario eliminado' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const usuarios = await this.usuarioService.list();
            res.status(200).json({ success: true, data: usuarios });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };
}
