import { Pool } from 'mysql2/promise';
import { CONFIG } from './src/config/config';
import mysql from 'mysql2/promise';

async function test() {
    const pool = mysql.createPool({
        host: CONFIG.dbHost,
        port: parseInt(CONFIG.dbPort as string),
        user: CONFIG.dbUser,
        password: CONFIG.dbPassword,
        database: CONFIG.dbName,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0,
        charset: 'utf8mb4_0900_ai_ci' 
    });

    try {
        console.log("Conectado con utf8mb4_0900_ai_ci. Probando queries...");
        const [rows] = await pool.execute(`
            SELECT COALESCE(SUM(saldo_pendiente), 0) FROM v_estado_pago_material WHERE estado_pago != 'pagado'
        `);
        console.log("Éxito:", rows);
    } catch (error: any) {
        console.error("Error:", error.message);
    } finally {
        await pool.end();
    }
}

test();
