import { RowDataPacket, Pool } from 'mysql2/promise';
import { RolSQL } from '../../models/auth/sql/rol.sql';

export class RolRepository {
    constructor(private db: Pool) {}

    async getById(id: number): Promise<RolSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Roles WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return null;
        }
        
        return rows[0] as RolSQL;
    }

    async list(): Promise<RolSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Roles');
        return rows as RolSQL[];
    }
}
