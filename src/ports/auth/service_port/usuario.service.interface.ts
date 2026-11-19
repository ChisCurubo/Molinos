import { UsuarioApp } from '../../../models/auth/app/usuario.app';

export interface IUsuarioService {
    login(username: string, clave: string): Promise<{ token: string; usuario: UsuarioApp }>;
    forgotPassword(username: string): Promise<void>;
    changePassword(id: number, actual: string, nueva: string): Promise<void>;
    resetPassword(token: string, nuevaPassword: string): Promise<void>;
    create(usuario: any): Promise<UsuarioApp>;
    getById(id: number): Promise<UsuarioApp | null>;
    update(id: number, data: any): Promise<UsuarioApp | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<UsuarioApp[]>;
}
