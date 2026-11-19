import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { IUsuarioService } from '../../ports/auth/service_port/usuario.service.interface';
import { IUsuarioRepository } from '../../ports/auth/repository_port/usuario.repository.interface';
import { UsuarioRepository } from '../../repositories/auth/usuario.repository';
import { RolRepository } from '../../repositories/auth/rol.repository';
import { UsuarioApp } from '../../models/auth/app/usuario.app';
import { UsuarioSQL } from '../../models/auth/sql/usuario.sql';
import {CONFIG} from '../../config/config';
import { sendMail } from '../../helpers/mailer';
import { invalidarUsuario } from '../../helpers/auth.middleware';

import { AppError } from '../../errors/app-error';


const CREDENCIALES = 'Credenciales inválidas';
// Hash de relleno para que "usuario inexistente" tarde lo mismo que "clave incorrecta" (evita enumerar por tiempo).
const HASH_FALSO = bcrypt.hashSync('relleno-tiempo-constante', 10);

/** Mínimo 8, máximo 72 (límite de bcrypt), con letra y número, y distinta del usuario. */
export function validarPassword(p: unknown, username?: string): void {
    if (typeof p !== 'string' || p.length < 8) throw AppError.validacion('La contraseña debe tener al menos 8 caracteres');
    if (p.length > 72) throw AppError.validacion('La contraseña no puede superar 72 caracteres');
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) throw AppError.validacion('La contraseña debe incluir letras y números');
    if (username && p.toLowerCase() === username.toLowerCase()) throw AppError.validacion('La contraseña no puede ser igual al usuario');
}

export class UsuarioService implements IUsuarioService {
    constructor(
        private usuarioRepository: IUsuarioRepository,
        private rolRepository: RolRepository
    ) {}

    private async buildUsuarioApp(sql: UsuarioSQL): Promise<UsuarioApp> {
        const app: UsuarioApp = { ...sql };
        delete app.password_hash; // nunca exponer el hash
        if (sql.id_rol) {
            const rol = await this.rolRepository.getById(sql.id_rol);
            if (rol) app.rol = rol;
        }
        return app;
    }

    async login(username: string, clave: string): Promise<{ token: string; usuario: UsuarioApp }> {
        const userSQL = await this.usuarioRepository.getByUsername(username);
        const validPassword = await bcrypt.compare(clave, userSQL?.password_hash ?? HASH_FALSO);
        if (!userSQL || !userSQL.activo || !validPassword) throw new AppError('INVALID_CREDENTIALS', CREDENCIALES);

        const userApp = await this.buildUsuarioApp(userSQL);
        const token = jwt.sign(
            { id: userApp.id, username: userApp.username, id_rol: userApp.rol?.id },
           CONFIG.jwtSecret,
            { expiresIn: '8h', algorithm: 'HS256', jwtid: randomUUID() }
        );

        // Actualizar último acceso
        await this.usuarioRepository.update(userSQL.id, { ultimo_acceso: new Date() });

        return { token, usuario: userApp };
    }

    // Token de reset sin tabla: firmado con secreto + hash actual, así se invalida al cambiar la clave (un solo uso).
    private resetSecret(u: UsuarioSQL) { return CONFIG.jwtSecret + u.password_hash; }

    /** Siempre resuelve sin revelar si el usuario existe. Solo usuarios cuyo username es un email reciben enlace. */
    async forgotPassword(username: string): Promise<void> {
        const u = await this.usuarioRepository.getByUsername(username);
        if (!u || !u.activo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.username)) return;
        const token = jwt.sign({ id: u.id, purpose: 'reset' }, this.resetSecret(u), { expiresIn: '15m', algorithm: 'HS256' });
        const link = `${CONFIG.frontendUrl}/reset-password?token=${token}`;
        await sendMail(u.username, 'Recuperar contraseña - Molinos',
            `Usa este enlace para elegir una nueva contraseña (vence en 15 minutos):
${link}

Si no lo pediste, ignora este correo.`);
    }

    async changePassword(id: number, actual: string, nueva: string): Promise<void> {
        const u = await this.usuarioRepository.getById(id);
        if (!u || !(await bcrypt.compare(actual, u.password_hash))) throw AppError.reglaNegocio('Contraseña actual incorrecta');
        const data: any = { password: nueva };
        if ('debe_cambiar_password' in u) data.debe_cambiar_password = false;
        await this.update(id, data);
    }

    async resetPassword(token: string, nuevaPassword: string): Promise<void> {
        const bad = AppError.reglaNegocio('Enlace inválido o vencido');
        const decoded = jwt.decode(token) as { id?: number } | null;
        const u = decoded?.id ? await this.usuarioRepository.getById(decoded.id) : null;
        if (!u || !u.activo) throw bad;
        try {
            const p = jwt.verify(token, this.resetSecret(u), { algorithms: ['HS256'] }) as { purpose?: string };
            if (p.purpose !== 'reset') throw bad;
        } catch { throw bad; }
        await this.update(u.id!, { password: nuevaPassword, ...('debe_cambiar_password' in u ? { debe_cambiar_password: false } : {}) });
    }

    async create(usuario: any): Promise<UsuarioApp> {
        validarPassword(usuario.password, usuario.username);
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(usuario.password, salt);

        const id = await this.usuarioRepository.create({
            username: usuario.username,
            password_hash: hash,
            id_rol: usuario.id_rol,
            id_empleado: usuario.id_empleado,
            activo: usuario.activo ?? true
        });

        const newSQL = await this.usuarioRepository.getById(id);
        return this.buildUsuarioApp(newSQL!);
    }

    async getById(id: number): Promise<UsuarioApp | null> {
        const sql = await this.usuarioRepository.getById(id);
        if (!sql) return null;
        return this.buildUsuarioApp(sql);
    }

    async update(id: number, data: any): Promise<UsuarioApp | null> {
        const updateData: Partial<UsuarioSQL> = { ...data };
        
        if (data.password) {
            const actual = await this.usuarioRepository.getById(id);
            validarPassword(data.password, data.username ?? actual?.username);
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(data.password, salt);
            delete (updateData as any).password;
        }

        await this.usuarioRepository.update(id, updateData);
        invalidarUsuario(id); // cambio de rol/activo se aplica ya
        return this.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        invalidarUsuario(id);
        return this.usuarioRepository.delete(id);
    }

    async list(): Promise<UsuarioApp[]> {
        const listSQL = await this.usuarioRepository.list();
        const listApp = await Promise.all(listSQL.map(sql => this.buildUsuarioApp(sql)));
        return listApp;
    }
}
