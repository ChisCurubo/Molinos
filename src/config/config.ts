import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    serverPort: process.env.SERVER_PORT || 3005,
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || '3306',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'molinos_erp_v4',
    jwtSecret: process.env.JWT_SECRET || 'molinos_123',
};