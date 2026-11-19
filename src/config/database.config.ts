import mysql from 'mysql2/promise';


import { CONFIG } from './config';

// Mensajes por errno que el cliente SÍ puede ver. El texto original (tablas, columnas, SQL) solo va al log del servidor.
const MENSAJES_BD: Record<number, string> = {
    1062: 'Ya existe un registro con esos datos',
    1451: 'El registro está relacionado con otros datos y no se puede eliminar o modificar',
    1452: 'El dato relacionado indicado no existe',
    1048: 'Falta un dato obligatorio', 1364: 'Falta un dato obligatorio',
    1406: 'Un dato es demasiado largo',
    1264: 'Un dato tiene un valor fuera de rango', 1265: 'Un dato tiene un valor inválido', 1366: 'Un dato tiene un formato inválido', 1292: 'Un dato tiene un formato inválido',
    3819: 'Los datos no cumplen una regla de validación',
};
const ERRORES_RED = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST', 'ECONNRESET'];

/**
 * Reemplaza el mensaje de un error de MySQL por uno genérico (muta el mismo objeto: conserva errno/code,
 * que algunos servicios consultan). Se respetan los SIGNAL de los triggers (errno 1644 / sqlState 45000):
 * son mensajes de negocio escritos a propósito.
 */
function sanear(e: any): any {
    if (!e || typeof e !== 'object') return e;
    const esSignal = e.errno === 1644 || e.sqlState === '45000';
    const esMysql = typeof e.errno === 'number' && (e.sqlState || String(e.code ?? '').startsWith('ER_'));
    const esRed = ERRORES_RED.includes(e.code);
    if (esSignal || !(esMysql || esRed)) return e;
    console.error(`[BD] errno=${e.errno ?? ''} code=${e.code ?? ''}: ${e.sqlMessage ?? e.message}`);
    e.message = esRed ? 'Servicio de datos no disponible' : (MENSAJES_BD[e.errno] ?? 'Error al procesar la solicitud en la base de datos');
    delete e.sqlMessage; delete e.sql;
    return e;
}
function proteger(obj: any): void {
    for (const m of ['query', 'execute']) {
        const orig = obj[m].bind(obj);
        obj[m] = async (...args: any[]) => { try { return await orig(...args); } catch (e) { throw sanear(e); } };
    }
}

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
                ssl: CONFIG.dbSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: CONFIG.dbSslRejectUnauthorized } : undefined,
                waitForConnections: true,
                connectionLimit: CONFIG.dbConnectionLimit,
                queueLimit: 0,
                charset: 'utf8mb4_0900_ai_ci' // Solución final para sincronizar con la BD
            });
            
            proteger(Database.pool);
            const getConn = Database.pool.getConnection.bind(Database.pool);
            (Database.pool as any).getConnection = async () => {
                try {
                    const c: any = await getConn();
                    if (!c.__protegida) { proteger(c); c.__protegida = true; } // las conexiones se reutilizan
                    return c;
                } catch (e) { throw sanear(e); }
            };

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
