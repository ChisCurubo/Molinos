import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUsuarioService } from '../../ports/auth/service_port/usuario.service.interface';
import { IUsuarioRepository } from '../../ports/auth/repository_port/usuario.repository.interface';
import { UsuarioRepository } from '../../repositories/auth/usuario.repository';
import { RolRepository } from '../../repositories/auth/rol.repository';
import { UsuarioApp } from '../../models/auth/app/usuario.app';
import { UsuarioSQL } from '../../models/auth/sql/usuario.sql';
import {CONFIG} from '../../config/config';


export class UsuarioService implements IUsuarioService {
    constructor(
        private usuarioRepository: IUsuarioRepository,
        private rolRepository: RolRepository
    ) {}

    private async buildUsuarioApp(sql: UsuarioSQL): Promise<UsuarioApp> {
        const app: UsuarioApp = { ...sql };
        if (sql.id_rol) {
            const rol = await this.rolRepository.getById(sql.id_rol);
            if (rol) app.rol = rol;
        }
        return app;
    }

    async login(username: string, clave: string): Promise<{ token: string; usuario: UsuarioApp }> {
        const userSQL = await this.usuarioRepository.getByUsername(username);
        if (!userSQL) throw new Error('Usuario no encontrado');
        if (!userSQL.activo) throw new Error('Usuario inactivo');

        // const validPassword = await bcrypt.compare(clave, userSQL.password_hash);
        // if (!validPassword) throw new Error('Contraseña incorrecta');
        if(clave != userSQL.password_hash) throw new Error('Contraseña incorrecta');

        const userApp = await this.buildUsuarioApp(userSQL);
        const token = jwt.sign(
            { id: userApp.id, username: userApp.username, id_rol: userApp.rol?.id },
           CONFIG.jwtSecret || 'secret123',
            { expiresIn: '8h' }
        );

        // Actualizar último acceso
        await this.usuarioRepository.update(userSQL.id, { ultimo_acceso: new Date() });

        return { token, usuario: userApp };
    }

    async forgotPassword(username: string): Promise<{ message: string; tempPassword?: string }> {
        const userSQL = await this.usuarioRepository.getByUsername(username);
        if (!userSQL) throw new Error('Usuario no encontrado');

        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(tempPassword, salt);

        await this.usuarioRepository.update(userSQL.id, { password_hash: newHash });

        return { 
            message: 'Contraseña temporal generada exitosamente. En producción, esto se enviaría por email.', 
            tempPassword 
        };
    }

    async create(usuario: any): Promise<UsuarioApp> {
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
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(data.password, salt);
            delete (updateData as any).password;
        }

        await this.usuarioRepository.update(id, updateData);
        return this.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.usuarioRepository.delete(id);
    }

    async list(): Promise<UsuarioApp[]> {
        const listSQL = await this.usuarioRepository.list();
        const listApp = await Promise.all(listSQL.map(sql => this.buildUsuarioApp(sql)));
        return listApp;
    }
}
