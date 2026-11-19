import { revocarToken, tokenDeRequest } from '../../helpers/auth.middleware';
import { CONFIG } from '../../config/config';
import { Request, Response } from 'express';
import { IUsuarioService } from '../../ports/auth/service_port/usuario.service.interface';
import { UsuarioService } from '../../services/auth/usuario.service';
import { fail } from '../../errors/responder';
import { AppError } from '../../errors/app-error';

export class AuthController {
    constructor(private usuarioService: IUsuarioService) {}

    login = async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                fail(res, AppError.http(400, 'Username y password son requeridos'));
                return;
            }

            const result = await this.usuarioService.login(username, password);
            res.cookie('token', result.token, CONFIG.cookieOpts);
            const { token: _t, ...sinToken } = result;
            res.status(200).json({ success: true, data: CONFIG.tokenEnBody ? result : sinToken });
        } catch (error: any) {
            fail(res, error, 401);
        }
    };

    forgotPassword = async (req: Request, res: Response): Promise<void> => {
        const { username } = req.body;
        if (!username) {
            fail(res, AppError.http(400, 'Username es requerido'));
            return;
        }
        try { await this.usuarioService.forgotPassword(String(username)); }
        catch (e) { console.error('[forgotPassword]', e); }
        // Respuesta idéntica exista o no el usuario (evita enumeración)
        res.status(200).json({ success: true, data: { message: 'Si la cuenta existe y tiene correo, recibirás un enlace para restablecer la contraseña.' } });
    };

    logout = async (req: Request, res: Response): Promise<void> => {
        revocarToken(tokenDeRequest(req));
        res.clearCookie('token', { ...CONFIG.cookieOpts, maxAge: undefined });
        res.status(200).json({ success: true, data: { message: 'Sesión cerrada' } });
    };

    changePassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const { actual, nueva } = req.body;
            if (!actual || !nueva || String(nueva).length < 8) {
                fail(res, AppError.http(400, 'actual y nueva (mínimo 8 caracteres) son requeridas'));
                return;
            }
            await this.usuarioService.changePassword(req.user!.id, actual, nueva);
            res.status(200).json({ success: true, data: { message: 'Contraseña actualizada' } });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };

    verify = async (req: Request, res: Response): Promise<void> => {
        try {
            // Si llega aqui, authMiddleware ya validó el token y adjuntó req.user
            const user = (req as any).user;
            res.status(200).json({ success: true, data: { valid: true, user } });
        } catch (error: any) {
            fail(res, error, 401);
        }
    };

    resetPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const { token, nuevaPassword } = req.body;
            if (!token || !nuevaPassword) {
                fail(res, AppError.http(400, 'token y nuevaPassword son requeridos'));
                return;
            }
            if (String(nuevaPassword).length < 8) {
                fail(res, AppError.http(400, 'La contraseña debe tener al menos 8 caracteres'));
                return;
            }
            await this.usuarioService.resetPassword(token, nuevaPassword);
            res.status(200).json({ success: true, data: { message: 'Contraseña actualizada exitosamente' } });
        } catch (error: any) {
            fail(res, error, 400);
        }
    };
}
