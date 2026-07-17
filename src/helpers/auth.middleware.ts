import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/config';


export interface JwtPayload {
    id: number;
    username: string;
    id_rol: number;
    rol_nombre?: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * Middleware principal: valida Bearer token, adjunta req.user = payload JWT
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Token de autorización requerido' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, CONFIG.jwtSecret || 'molinos_123') as JwtPayload;
        req.user = payload;
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }
};

/**
 * Middleware de rol: verifica que req.user.id_rol está en la lista permitida
 */
export const requireRole = (roles: number[]) => (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
    }
    if (!roles.includes(req.user.id_rol)) {
        res.status(403).json({ success: false, error: 'No tienes permisos para acceder a este recurso' });
        return;
    }
    next();
};
