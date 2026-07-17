import { Request, Response } from 'express';
import { IUsuarioService } from '../../ports/auth/service_port/usuario.service.interface';
import { UsuarioService } from '../../services/auth/usuario.service';

export class AuthController {
    constructor(private usuarioService: IUsuarioService) {}

    login = async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                res.status(400).json({ success: false, error: 'Username y password son requeridos' });
                return;
            }

            const result = await this.usuarioService.login(username, password);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            res.status(401).json({ success: false, error: error.message });
        }
    };

    forgotPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const { username } = req.body;
            if (!username) {
                res.status(400).json({ success: false, error: 'Username es requerido' });
                return;
            }
            const result = await this.usuarioService.forgotPassword(username);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            res.status(404).json({ success: false, error: error.message });
        }
    };

    verify = async (req: Request, res: Response): Promise<void> => {
        try {
            // Si llega aqui, authMiddleware ya validó el token y adjuntó req.user
            const user = (req as any).user;
            res.status(200).json({ success: true, data: { valid: true, user } });
        } catch (error: any) {
            res.status(401).json({ success: false, error: error.message });
        }
    };

    resetPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, tempPassword, nuevaPassword } = req.body;
            if (!username || !tempPassword || !nuevaPassword) {
                res.status(400).json({ success: false, error: 'username, tempPassword y nuevaPassword son requeridos' });
                return;
            }
            // Primero verificar credenciales con tempPassword
            const loginResult = await this.usuarioService.login(username, tempPassword);
            if (!loginResult) {
                res.status(401).json({ success: false, error: 'Credenciales temporales inválidas' });
                return;
            }
            await this.usuarioService.update(loginResult.usuario.id!, { password: nuevaPassword });
            res.status(200).json({ success: true, data: { message: 'Contraseña actualizada exitosamente' } });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    };
}
