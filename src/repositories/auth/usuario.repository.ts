import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import Database from '../../config/database.config';
import { UsuarioSQL } from '../../models/auth/sql/usuario.sql';
import { IUsuarioRepository } from '../../ports/auth/repository_port/usuario.repository.interface';

export class UsuarioRepository implements IUsuarioRepository {
    async create(usuario: Omit<UsuarioSQL, 'id' | 'created_at'>): Promise<number> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Usuarios (username, password_hash, id_rol, id_empleado, activo) 
             VALUES (?, ?, ?, ?, ?)`,
            [usuario.username, usuario.password_hash, usuario.id_rol, usuario.id_empleado ?? null, usuario.activo ?? true]
        );
        return result.insertId;
    }

    async getById(id: number): Promise<UsuarioSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Usuarios WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as UsuarioSQL;
    }

    async getByUsername(username: string): Promise<UsuarioSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Usuarios WHERE username = ?', [username]);
        if (rows.length === 0) return null;
        return rows[0] as UsuarioSQL;
    }

    async update(id: number, data: Partial<UsuarioSQL>): Promise<boolean> {
        const db = Database.getInstance();
        
        // Dynamic query builder
        const fields: string[] = [];
        const values: any[] = [];
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (fields.length === 0) return false;
        
        values.push(id);
        const query = `UPDATE Usuarios SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Usuarios WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<UsuarioSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Usuarios');
        return rows as UsuarioSQL[];
    }
}
