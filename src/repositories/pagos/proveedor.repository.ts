import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { CategoriaProveedorSQL } from '../../models/pagos/sql/categoria_proveedor.sql';
import { ProveedorSQL } from '../../models/pagos/sql/proveedor.sql';
import { ICategoriaProveedorRepository, IProveedorRepository } from '../../ports/pagos/repository_port/proveedor.repository.interface';

// --- Original: categoria_proveedor ---
export class CategoriaProveedorRepository implements ICategoriaProveedorRepository {
    constructor(private db: Pool) {}

    async create(data: Omit<CategoriaProveedorSQL, 'id'>): Promise<number> {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Categorias_Proveedor (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<CategoriaProveedorSQL | null> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_Proveedor WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as CategoriaProveedorSQL;
    }

    async update(id: number, data: Partial<CategoriaProveedorSQL>): Promise<boolean> {
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
        
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Categorias_Proveedor SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Categorias_Proveedor WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<CategoriaProveedorSQL[]> {
        const [rows] = await this.db.query<RowDataPacket[]>('SELECT * FROM Categorias_Proveedor');
        return rows as CategoriaProveedorSQL[];
    }
}

// --- Proveedores (la entidad real: transportadoras de mula, laboratorios, gasolineras, etc.) ---
export class ProveedorRepository implements IProveedorRepository {
    constructor(private db: Pool) {}

    async create(data: { nombre: string; id_categoria?: number; tipo?: string; contacto?: string; telefono?: string; ciudad?: string; alias?: string; nequi?: boolean; compra_realizada?: string; estado?: string }): Promise<number> {
        const [result] = await this.db.query<ResultSetHeader>(
            `INSERT INTO Proveedores (nombre, id_categoria, tipo, contacto, telefono, ciudad, alias, nequi, compra_realizada, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.nombre, data.id_categoria ?? null, data.tipo || 'general', data.contacto ?? null, data.telefono ?? null,
             data.ciudad ?? null, data.alias ?? null, data.nequi ?? false, data.compra_realizada ?? null,
             data.estado || 'activo']
        );
        return result.insertId;
    }

    async getById(id: number): Promise<any | null> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT p.*, cp.nombre AS categoria
             FROM Proveedores p
             LEFT JOIN Categorias_Proveedor cp ON cp.id = p.id_categoria
             WHERE p.id = ?`,
            [id]
        );
        return rows.length ? rows[0] : null;
    }

    async update(id: number, data: Partial<ProveedorSQL>): Promise<boolean> {
        const permitidos = ['nombre', 'id_categoria', 'tipo', 'contacto', 'telefono', 'ciudad', 'alias', 'nequi', 'compra_realizada', 'estado'];
        const fields: string[] = []; const values: any[] = [];
        for (const k of permitidos) if ((data as any)[k] !== undefined) { fields.push(`${k} = ?`); values.push((data as any)[k]); }
        if (fields.length === 0) return false;
        values.push(id);
        const [result] = await this.db.query<ResultSetHeader>(`UPDATE Proveedores SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.db.query<ResultSetHeader>('DELETE FROM Proveedores WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(filtros: { id_categoria?: number; tipo?: string; estado?: string; q?: string }): Promise<any[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_categoria) { where.push('p.id_categoria = ?'); params.push(filtros.id_categoria); }
        if (filtros.tipo) { where.push('p.tipo = ?'); params.push(filtros.tipo); }
        if (filtros.estado) { where.push('p.estado = ?'); params.push(filtros.estado); }
        if (filtros.q) { where.push('(p.nombre LIKE ? OR p.alias LIKE ?)'); params.push(`%${filtros.q}%`, `%${filtros.q}%`); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT p.*, cp.nombre AS categoria
             FROM Proveedores p
             LEFT JOIN Categorias_Proveedor cp ON cp.id = p.id_categoria
             ${whereSql}
             ORDER BY p.nombre`,
            params
        );
        return rows;
    }
}