import { UsuarioSQL } from '../../models/auth/sql/usuario.sql';

export interface IUsuarioRepository {
    create(usuario: Omit<UsuarioSQL, 'id' | 'created_at'>): Promise<number>;
    getById(id: number): Promise<UsuarioSQL | null>;
    getByUsername(username: string): Promise<UsuarioSQL | null>;
    update(id: number, data: Partial<UsuarioSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<UsuarioSQL[]>;
}
