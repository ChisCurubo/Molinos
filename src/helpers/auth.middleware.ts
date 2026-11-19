import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/config';
import Database from '../config/database.config';
import { fail } from '../errors/responder';
import { AppError } from '../errors/app-error';


export interface JwtPayload {
    id: number;
    username: string;
    id_rol: number;
    rol_nombre?: string;
    jti?: string;
    exp?: number;
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
// Tokens cerrados con logout (por jti) hasta que vencerían. shortcut: memoria de un proceso; se pierde al reiniciar
// y no se comparte entre réplicas (con eso, mover a tabla/Redis). El token también muere si desactivas al usuario.
const revocados = new Map<string, number>();
export const revocarToken = (token?: string): void => {
    const p = token ? (jwt.decode(token) as JwtPayload | null) : null;
    if (!p?.jti || !p.exp) return;
    const ahora = Date.now() / 1000;
    revocados.forEach((exp, k) => { if (exp < ahora) revocados.delete(k); });
    revocados.set(p.jti, p.exp);
};
export const tokenDeRequest = (req: Request): string | undefined => {
    const h = req.headers.authorization;
    return h?.startsWith('Bearer ') ? h.split(' ')[1] : req.cookies?.token;
};

// Estado vivo del usuario (activo + rol) con caché corta: un usuario desactivado o con otro rol
// pierde el acceso en <= 30 s aunque su token siga vigente. update/delete de usuarios invalidan al instante.
// shortcut: caché en memoria de un proceso; con varias réplicas el tope sigue siendo 30 s.
const TTL_MS = 30_000;
const estado = new Map<number, { activo: boolean; id_rol: number; hasta: number }>();
export const invalidarUsuario = (id: number) => { estado.delete(id); };

async function estadoUsuario(id: number) {
    const c = estado.get(id);
    if (c && c.hasta > Date.now()) return c;
    const [rows] = await Database.getInstance().query<any[]>('SELECT activo, id_rol FROM Usuarios WHERE id = ?', [id]);
    const e = { activo: !!rows[0]?.activo, id_rol: rows[0]?.id_rol ?? 0, hasta: Date.now() + TTL_MS };
    if (rows.length) estado.set(id, e); else estado.delete(id);
    return rows.length ? e : { ...e, activo: false };
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.token;
    if (!token) {
        fail(res, new AppError('UNAUTHENTICATED', 'Token de autorización requerido'));
        return;
    }

    try {
        const payload = jwt.verify(token, CONFIG.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
        if (payload.jti && revocados.has(payload.jti)) { fail(res, new AppError('TOKEN_INVALID', 'Sesión cerrada, inicia sesión de nuevo')); return; }
        const vivo = await estadoUsuario(payload.id);
        if (!vivo.activo) { fail(res, new AppError('USER_INACTIVE', 'Usuario inactivo o inexistente')); return; }
        req.user = { ...payload, id_rol: vivo.id_rol }; // el rol manda lo de la BD, no lo del token
        next();
    } catch (error: any) {
        if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError' || error?.name === 'NotBeforeError') {
            fail(res, error); // JsonWebTokenError -> TOKEN_INVALID, TokenExpiredError -> TOKEN_EXPIRED (ver normalizarError)
        } else {
            console.error('[auth] no se pudo validar al usuario:', error?.message);
            fail(res, new AppError('SERVICE_UNAVAILABLE', 'Servicio no disponible')); // falla cerrado: sin poder validar al usuario, no se deja pasar
        }
    }
};

/**
 * Middleware de rol: verifica que req.user.id_rol está en la lista permitida
 */
export const requireRole = (roles: number[]) => (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
        fail(res, new AppError('UNAUTHENTICATED', 'No autenticado'));
        return;
    }
    if (req.user.username !== CONFIG.superAdmin && !roles.includes(req.user.id_rol)) {
        fail(res, AppError.prohibido());
        return;
    }
    next();
};

/**
 * Acceso por método: `write` pueden todo; `read` solo GET/HEAD/OPTIONS.
 */
export const requireAccess = (opts: { write: number[]; read?: number[] }) =>
    (req: Request, res: Response, next: NextFunction): void => {
        const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        const allowed = isRead ? [...opts.write, ...(opts.read ?? [])] : opts.write;
        requireRole(allowed)(req, res, next);
    };
