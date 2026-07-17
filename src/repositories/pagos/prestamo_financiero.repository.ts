import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { PrestamoFinancieroSQL } from '../../models/pagos/sql/prestamo_financiero.sql';
import { IPrestamoFinancieroRepository } from '../../ports/pagos/repository_port/prestamo_financiero.repository.interface';

export class PrestamoFinancieroRepository implements IPrestamoFinancieroRepository {
    constructor(private db: Pool) {}

    async create(data: Partial<PrestamoFinancieroSQL>): Promise<number> {
        const query = `
            INSERT INTO prestamos_financieros (nombre_prestamo, fecha_adquisicion, monto_principal, tasa_interes, saldo_pendiente, activo)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.nombre_prestamo, data.fecha_adquisicion, data.monto_principal, data.tasa_interes, data.saldo_pendiente, data.activo ?? 1
        ];
        const [result] = await this.db.query<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async getById(id: number): Promise<PrestamoFinancieroSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM prestamos_financieros WHERE id = ?', [id]);
        return rows.length ? rows[0] as PrestamoFinancieroSQL : null;
    }

    async update(id: number, data: Partial<PrestamoFinancieroSQL>): Promise<boolean> {
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
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE prestamos_financieros SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async list(): Promise<PrestamoFinancieroSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM prestamos_financieros ORDER BY fecha_adquisicion DESC');
        return rows as PrestamoFinancieroSQL[];
    }
}
