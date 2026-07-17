import { PoolConnection, ResultSetHeader, Pool } from 'mysql2/promise';
import { IViajesRepository } from '../../ports/material/viajes.interface';

export class ViajesRepository implements IViajesRepository {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    private getConn(conn?: PoolConnection): PoolConnection | Pool {
        return conn || this.db;
    }

    async crearCabeceraViaje(data: any, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO Viaje (
                numero_viaje, fecha, comentarios
            ) VALUES (?, ?, ?)
        `;
        const values = [
            data.numero_viaje,
            data.fecha || new Date(),
            data.comentarios || null
        ];
        
        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async obtenerViajePorId(id: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT * FROM Viaje WHERE id = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async asignarLoteAViaje(data: any, conn?: PoolConnection): Promise<number> {
        const connection = this.getConn(conn);
        const query = `
            INSERT INTO viaje_material (
                id_viaje, id_material_concentrado, total_concentrado_humedo,
                concentrado_seco, porcentaje_humedad, peso_humedad,
                es_remanente, id_viaje_origen, concepto,
                valor_total_con_gastos, costo_maquila
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `;
        const values = [
            data.id_viaje,
            data.id_material_concentrado,
            data.total_concentrado_humedo,
            data.concentrado_seco || 0,
            data.porcentaje_humedad || 0,
            data.peso_humedad || 0,
            data.es_remanente || 0,
            data.id_viaje_origen || null,
            data.concepto || null
        ];
        
        const [result] = await connection.execute<ResultSetHeader>(query, values);
        return result.insertId;
    }

    async eliminarLineaViaje(idLinea: number, conn?: PoolConnection): Promise<void> {
        const connection = this.getConn(conn);
        await connection.execute(
            `DELETE FROM viaje_material WHERE id = ?`,
            [idLinea]
        );
    }

    async obtenerLineaViajePorId(idLinea: number, conn?: PoolConnection): Promise<any> {
        const connection = this.getConn(conn);
        const [rows] = await connection.execute<any[]>(
            `SELECT * FROM viaje_material WHERE id = ?`,
            [idLinea]
        );
        return rows.length > 0 ? rows[0] : null;
    }
}
