import mysql from 'mysql2/promise';


import { CONFIG } from './config';

class Database {
    private static pool: mysql.Pool;

    public static getInstance(): mysql.Pool {
        if (!Database.pool) {
            console.log('[Helpers] Inicializando pool de conexiones a la base de datos MySQL...');
            
            Database.pool = mysql.createPool({
                host: CONFIG.dbHost,
                port: parseInt(CONFIG.dbPort as string),
                user: CONFIG.dbUser,
                password: CONFIG.dbPassword,
                database: CONFIG.dbName,
                waitForConnections: true,
                connectionLimit: 25,
                queueLimit: 0,
                charset: 'utf8mb4_0900_ai_ci' // Solución final para sincronizar con la BD
            });
            
            // Verificar la conexión inmediatamente
            Database.pool.getConnection()
                .then(connection => {
                    console.log('[Helpers] Conexión a la base de datos MySQL establecida exitosamente 🚀');
                    connection.release();
                })
                .catch(err => {
                    console.error('[Error] Falló la conexión a la base de datos MySQL ❌:', err.message);
                });
        }

        return Database.pool;
    }

    /**
     * Ejecuta una función dentro de una transacción MySQL.
     * Pide la conexión, inicia la transacción, ejecuta el callback y hace commit o rollback.
     */
    public static async withTransaction<T>(
        callback: (connection: mysql.PoolConnection) => Promise<T>
    ): Promise<T> {
        const pool = Database.getInstance();
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default Database;
