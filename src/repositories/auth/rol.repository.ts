import { RowDataPacket } from 'mysql2/promise';
import Database from '../../config/database.config';
import { RolSQL } from '../../models/auth/sql/rol.sql';

export class RolRepository {
    async getById(id: number): Promise<RolSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Roles WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return null;
        }
        
        return rows[0] as RolSQL;
    }

    async list(): Promise<RolSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Roles');
        return rows as RolSQL[];
    }
}
