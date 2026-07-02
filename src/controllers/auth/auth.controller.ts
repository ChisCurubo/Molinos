import { Request, Response } from 'express';
import { IUsuarioService } from '../../ports/auth/service_port/usuario.service.interface';
import { UsuarioService } from '../../services/auth/usuario.service';

export class AuthController {
    private usuarioService: IUsuarioService;

    constructor() {
        this.usuarioService = new UsuarioService();
    }

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
}
