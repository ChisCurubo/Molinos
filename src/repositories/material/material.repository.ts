import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { MaterialPlantaEntradaRepositoryInterface } from '../../ports/material/repository_port/material.repository.interface';
import { MaterialPlantaEntradaSQL } from '../../../models/material/sql/material_planta_entrada.sql';
import Database from '../../../config/database.config';
import { TipoMaterialSQL } from '../../../models/material/sql/tipo_material.sql';
import { ITipoMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { PrecioMaterialSQL } from '../../../models/material/sql/precio_material.sql';
import { IPrecioMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { TarifaCalculoSQL } from '../../../models/material/sql/tarifa_calculo.sql';
import { ITarifaCalculoRepository } from '../../ports/material/repository_port/material.repository.interface';
import { ProveedorSQL } from '../../../models/pagos/sql/proveedor.sql';
import { IProveedorRepository } from '../../ports/material/repository_port/material.repository.interface';

// --- Original: material_planta_entrada ---
export class MySQLMaterialPlantaEntradaRepo implements MaterialPlantaEntradaRepositoryInterface {
    private pool: Pool;

    constructor() {
        this.pool = Database.getInstance();
    }

    async create(entrada: Partial<MaterialPlantaEntradaSQL>): Promise<MaterialPlantaEntradaSQL> {
        const query = `INSERT INTO material_planta_entrada 
            (numero_volqueta, id_mina, id_vehiculo, id_tipo_material, id_precio, fecha_llegada, peso_llegada_planta, porcentaje_humedad, gramos_humedad, tenor, total_material_seco, total_gramos, precio_por_gramo, precio_por_tonelada, precio_total, estado, estado_pago_flete, comentarios) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values: any[] = [
            entrada.numero_volqueta, entrada.id_mina, entrada.id_vehiculo || null,
            entrada.id_tipo_material, entrada.id_precio || null, entrada.fecha_llegada,
            entrada.peso_llegada_planta, entrada.porcentaje_humedad, entrada.gramos_humedad || null,
            entrada.tenor || null, entrada.total_material_seco || null, entrada.total_gramos || null,
            entrada.precio_por_gramo || null, entrada.precio_por_tonelada || null, entrada.precio_total || null,
            entrada.estado || 'pendiente', entrada.estado_pago_flete || 'pendiente', entrada.comentarios || null
        ];
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return { id: result.insertId, ...entrada } as MaterialPlantaEntradaSQL;
    }

    async getById(id: number): Promise<MaterialPlantaEntradaSQL | null> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM material_planta_entrada WHERE id = ?`,
            [id]
        );
        return rows.length ? (rows[0] as MaterialPlantaEntradaSQL) : null;
    }

    async listAll(): Promise<MaterialPlantaEntradaSQL[]> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT * FROM material_planta_entrada ORDER BY created_at DESC`
        );
        return rows as MaterialPlantaEntradaSQL[];
    }

    async update(id: number, entrada: Partial<MaterialPlantaEntradaSQL>): Promise<boolean> {
        const query = `UPDATE material_planta_entrada SET estado = ?, comentarios = ? WHERE id = ?`;
        const values: any[] = [entrada.estado, entrada.comentarios, id];
        const [result] = await this.pool.execute<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async actualizarFases3a5(id_entrada: number, data: any, conn?: import('mysql2/promise').PoolConnection): Promise<void> {
        const connection = conn || this.pool;
        const query = `
            UPDATE material_planta_entrada SET
                porcentaje_humedad      = ?,
                gramos_humedad          = ?,
                total_material_seco     = ?,
                tenor                   = ?,
                total_gramos            = ?,
                id_precio               = ?,
                precio_por_gramo        = ?,
                precio_por_tonelada     = ?,
                precio_total            = ?,
                excedente_calculado     = ?,
                costo_cargue            = ?,
                costo_bascula           = ?,
                costo_maquila           = ?,
                costo_adicional         = ?,
                costo_volqueta          = ?,
                total_costos_operativos = ?,
                total_material          = ?
            WHERE id = ?
        `;
        const values = [
            data.porcentaje_humedad, data.gramos_humedad, data.total_material_seco, data.tenor, data.total_gramos,
            data.id_precio, data.precio_por_gramo, data.precio_por_tonelada, data.precio_total,
            data.excedente_calculado, data.costo_cargue, data.costo_bascula, data.costo_maquila, data.costo_adicional, data.costo_volqueta, data.total_costos_operativos, data.total_material,
            id_entrada
        ];
        await connection.execute(query, values);
    }

    async listar(fechaDesde: string, fechaHasta: string, estado: string, limit: number, offset: number): Promise<any[]> {
        const query = `
            SELECT
                mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mi.nombre AS mina, mn.nombre AS minero,
                mn.alias AS minero_alias, vv.placa, dv.nombre AS dueno_volqueta, tm.nombre AS tipo_material,
                mpe.peso_llegada_planta, mpe.total_material_seco, mpe.tenor, mpe.precio_total,
                mpe.total_material, mpe.estado, mpe.estado_pago_flete,
                EXISTS (SELECT 1 FROM analisis a WHERE a.id_entrada = mpe.id AND a.id_tipo_analisis = 1) AS tiene_analisis_cabeza
            FROM material_planta_entrada mpe
            JOIN mina mi ON mi.id = mpe.id_mina
            LEFT JOIN minero mn ON mn.id = mi.id_minero
            LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
            LEFT JOIN dueno_volqueta dv ON dv.id = vv.id_dueno_volqueta
            JOIN tipos_material tm ON tm.id = mpe.id_tipo_material
            WHERE mpe.fecha_llegada BETWEEN ? AND ? AND (mpe.estado = ? OR ? = '')
            ORDER BY mpe.fecha_llegada DESC, mpe.id DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [fechaDesde, fechaHasta, estado, estado, String(limit), String(offset)]);
        return rows as any[];
    }

    async listarPendientesLaboratorio(): Promise<any[]> {
        const query = `
            SELECT
                mpe.id, mpe.numero_volqueta, mpe.fecha_llegada, mi.nombre AS mina, mn.nombre AS minero,
                vv.placa, mpe.peso_llegada_planta, mpe.id_tipo_material AS tipo_material_id, tm.nombre AS tipo_material,
                DATEDIFF(CURRENT_DATE, mpe.fecha_llegada) AS dias_sin_analisis
            FROM material_planta_entrada mpe
            JOIN mina mi ON mi.id = mpe.id_mina
            LEFT JOIN minero mn ON mn.id = mi.id_minero
            LEFT JOIN volqueta_vehiculo vv ON vv.id = mpe.id_vehiculo
            JOIN tipos_material tm ON tm.id = mpe.id_tipo_material
            WHERE mpe.porcentaje_humedad = 0 OR mpe.tenor IS NULL
            ORDER BY mpe.fecha_llegada
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query);
        return rows as any[];
    }
}

// --- Original: tipo_material ---
export class TipoMaterialRepository implements ITipoMaterialRepository {
    async create(data: Omit<TipoMaterialSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Tipos_Material (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TipoMaterialSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tipos_Material WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TipoMaterialSQL;
    }

    async update(id: number, data: Partial<TipoMaterialSQL>): Promise<boolean> {
        const db = Database.getInstance();
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
        
        const query = `UPDATE Tipos_Material SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Tipos_Material WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TipoMaterialSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tipos_Material');
        return rows as TipoMaterialSQL[];
    }
}

// --- Original: precio_material ---
export class PrecioMaterialRepository implements IPrecioMaterialRepository {
    async create(data: Omit<PrecioMaterialSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Precio_Material (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<PrecioMaterialSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Precio_Material WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as PrecioMaterialSQL;
    }

    async update(id: number, data: Partial<PrecioMaterialSQL>): Promise<boolean> {
        const db = Database.getInstance();
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
        
        const query = `UPDATE Precio_Material SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Precio_Material WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<PrecioMaterialSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Precio_Material');
        return rows as PrecioMaterialSQL[];
    }

    async buscarPrecioAplicable(idMinero: number | null, idZona: number | null, metodo: string, tenorFalso: number, fechaEntrada: string, conn?: import('mysql2/promise').PoolConnection): Promise<any | null> {
        const connection = conn || Database.getInstance();
        const query = `
            SELECT id, metodo, precio_por_gramo, precio_por_tonelada, intervalo_tenor_min, intervalo_tenor_max
            FROM precio_material pm
            WHERE pm.activo = 1
              AND pm.metodo = ?
              AND (pm.id_minero = ? OR pm.id_minero IS NULL)
              AND (pm.id_zona = ? OR pm.id_zona IS NULL)
              AND ? BETWEEN pm.intervalo_tenor_min AND pm.intervalo_tenor_max
              AND pm.fecha_inicio <= ?
              AND (pm.fecha_fin IS NULL OR pm.fecha_fin >= ?)
            ORDER BY pm.id_minero DESC, pm.id_zona DESC, pm.fecha_inicio DESC
            LIMIT 1
        `;
        const [rows] = await connection.execute<RowDataPacket[]>(query, [
            metodo, idMinero, idZona, tenorFalso, fechaEntrada, fechaEntrada
        ]);
        return rows.length > 0 ? rows[0] : null;
    }
}

// --- Original: tarifa_calculo ---
export class TarifaCalculoRepository implements ITarifaCalculoRepository {
    async create(data: Omit<TarifaCalculoSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Tarifas_Calculo (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<TarifaCalculoSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tarifas_Calculo WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as TarifaCalculoSQL;
    }

    async update(id: number, data: Partial<TarifaCalculoSQL>): Promise<boolean> {
        const db = Database.getInstance();
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
        
        const query = `UPDATE Tarifas_Calculo SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Tarifas_Calculo WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<TarifaCalculoSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Tarifas_Calculo');
        return rows as TarifaCalculoSQL[];
    }

    async obtenerTarifaZonaOCalculo(idZona: number | null, conn?: import('mysql2/promise').PoolConnection): Promise<number> {
        const connection = conn || Database.getInstance();
        if (idZona) {
            const queryZona = `
                SELECT valor_tonelada
                FROM tarifa_zona
                WHERE id_zona = ? AND activo = 1 AND vigente_desde <= CURRENT_DATE AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
                ORDER BY vigente_desde DESC LIMIT 1
            `;
            const [rowsZona] = await connection.execute<RowDataPacket[]>(queryZona, [idZona]);
            if (rowsZona.length > 0) return Number(rowsZona[0].valor_tonelada);
        }
        
        const queryGlobal = `SELECT valor FROM tarifas_calculo WHERE codigo = 'flete_ton_seca'`;
        const [rowsGlobal] = await connection.execute<RowDataPacket[]>(queryGlobal);
        if (rowsGlobal.length > 0) return Number(rowsGlobal[0].valor);
        
        return 0; // Fallback extremo
    }
}

// --- Original: proveedor ---
export class ProveedorRepository implements IProveedorRepository {
    async create(data: Omit<ProveedorSQL, 'id'>): Promise<number> {
        const db = Database.getInstance();
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map(() => '?').join(', ');
        
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO Proveedores (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        return result.insertId;
    }

    async getById(id: number): Promise<ProveedorSQL | null> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Proveedores WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rows[0] as ProveedorSQL;
    }

    async update(id: number, data: Partial<ProveedorSQL>): Promise<boolean> {
        const db = Database.getInstance();
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
        
        const query = `UPDATE Proveedores SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.query<ResultSetHeader>(query, values);
        return result.affectedRows > 0;
    }

    async delete(id: number): Promise<boolean> {
        const db = Database.getInstance();
        const [result] = await db.query<ResultSetHeader>('DELETE FROM Proveedores WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    async list(): Promise<ProveedorSQL[]> {
        const db = Database.getInstance();
        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM Proveedores');
        return rows as ProveedorSQL[];
    }
}
