import { Request, Response } from 'express';
import { IUsuarioService } from '../../ports/auth/service_port/usuario.service.interface';
import { UsuarioService } from '../../services/auth/usuario.service';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class UsuarioController {
    constructor(private usuarioService: IUsuarioService) {}

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const usuario = await this.usuarioService.create(req.body);
            res.status(201).json({ success: true, data: usuario });
        } catch (error: any) {
            fail(res, error);
        }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const usuario = await this.usuarioService.getById(id);
            if (!usuario) {
                fail(res, AppError.http(404, 'Usuario no encontrado'));
                return;
            }
            res.status(200).json({ success: true, data: usuario });
        } catch (error: any) {
            fail(res, error);
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const usuario = await this.usuarioService.update(id, req.body);
            if (!usuario) {
                fail(res, AppError.http(404, 'Usuario no encontrado o sin cambios'));
                return;
            }
            res.status(200).json({ success: true, data: usuario });
        } catch (error: any) {
            fail(res, error);
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id as string, 10);
            const deleted = await this.usuarioService.delete(id);
            if (!deleted) {
                fail(res, AppError.http(404, 'Usuario no encontrado'));
                return;
            }
            res.status(200).json({ success: true, message: 'Usuario eliminado' });
        } catch (error: any) {
            fail(res, error);
        }
    };

    list = async (req: Request, res: Response): Promise<void> => {
        try {
            const usuarios = await this.usuarioService.list();
            res.status(200).json({ success: true, data: usuarios });
        } catch (error: any) {
            fail(res, error);
        }
    };
}
