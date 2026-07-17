import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { UsuarioSQL } from '../../models/auth/sql/usuario.sql';
import { IUsuarioRepository } from '../../ports/auth/repository_port/usuario.repository.interface';

export class UsuarioRepository implements IUsuarioRepository {
    constructor(private db: Pool) {}

    async create(usuario: Omit<UsuarioSQL, 'id' | 'created_at'>): Promise<number> {
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Usuarios (username, password_hash, id_rol, id_empleado, activo) 
             VALUES (?, ?, ?, ?, ?)`,
            [usuario.username, usuario.password_hash, usuario.id_rol, usuario.id_empleado ?? null, usuario.activo ?? true]
        );
        return result.insertId;
    }

    async getById(id: number): Promise<UsuarioSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Usuarios WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as UsuarioSQL;
    }

    async getByUsername(username: string): Promise<UsuarioSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Usuarios WHERE username = ?', [username]);
        if (rows.length === 0) return null;
        return rows[0] as UsuarioSQL;
    }

    async update(id: number, data: Partial<UsuarioSQL>): Promise<boolean> {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.username !== undefined) { updates.push('username = ?'); values.push(data.username); }
        if (data.password_hash !== undefined) { updates.push('password_hash = ?'); values.push(data.password_hash); }
        if (data.id_rol !== undefined) { updates.push('id_rol = ?'); values.push(data.id_rol); }
        if (data.id_empleado !== undefined) { updates.push('id_empleado = ?'); values.push(data.id_empleado); }
        if (data.activo !== undefined) { updates.push('activo = ?'); values.push(data.activo); }

        if (updates.length === 0) return false;

        values.push(id);
        const [result] = await this.db.query<ResultSetHeader>(
            `UPDATE Usuarios SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Usuarios WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<UsuarioSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Usuarios');
        return rows as UsuarioSQL[];
    }
}
