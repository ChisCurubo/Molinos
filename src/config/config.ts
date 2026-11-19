import dotenv from 'dotenv';
dotenv.config(); // antes de leer entorno.ts: APP_MODE puede venir del .env

import { MODO, MOTIVO_MODO } from './entorno';

/**
 * Configuración por modo (ver entorno.ts). Regla: UNA VARIABLE DE ENTORNO SIEMPRE GANA;
 * si falta, se usa el valor por defecto del modo (`oracle` = servidor, `local` = PC de desarrollo).
 */
const modo = MODO;
const motivoModo = MOTIVO_MODO;
const oracle = modo === 'oracle';

const env = (k: string): string | undefined => {
    const v = process.env[k];
    return v === undefined || v.trim() === '' ? undefined : v.trim();
};
const bool = (k: string, porDefecto: boolean): boolean => {
    const v = env(k);
    return v === undefined ? porDefecto : v.toLowerCase() === 'true';
};
const lista = (v?: string): string[] => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

const isProd = (env('ENV') ?? (oracle ? 'production' : 'development')) === 'production';

// En el servidor no se arranca con secretos ausentes o débiles (el valor por defecto es público en el repo).
if ((oracle || isProd) && (env('JWT_SECRET') ?? '').length < 32) {
    throw new Error('JWT_SECRET es obligatorio en producción/oracle (mínimo 32 caracteres). El servidor no arranca sin él.');
}
if (oracle && !env('DB_PASSWORD')) {
    throw new Error('DB_PASSWORD es obligatoria en modo oracle (la deja cloud-init en /opt/molinos/db.env). El servidor no arranca sin ella.');
}

const dbSsl = bool('DB_SSL', oracle);
const driver = (env('STORAGE_DRIVER') ?? (oracle ? 'minio' : 'disco')).toLowerCase();
const cookieSecure = bool('COOKIE_SECURE', oracle); // escape: COOKIE_SECURE=false si el HTTPS falla

export const CONFIG = {
    modo,
    motivoModo,
    serverPort: env('SERVER_PORT') || 3005,
    dbHost: env('DB_HOST') ?? (oracle ? '10.0.1.30' : 'localhost'),
    dbPort: env('DB_PORT') ?? '3306',
    dbUser: env('DB_USER') ?? (oracle ? 'molinos_app' : 'root'),
    dbPassword: process.env.DB_PASSWORD ?? '',
    dbName: env('DB_NAME') ?? 'molinos_erp_v4',
    dbSsl,
    // HeatWave usa un certificado propio de Oracle: no se puede verificar contra las CA públicas.
    dbSslRejectUnauthorized: bool('DB_SSL_REJECT_UNAUTHORIZED', !oracle),
    dbConnectionLimit: Number(env('DB_CONNECTION_LIMIT') ?? 10), // MySQL.Free tiene pocos recursos
    jwtSecret: env('JWT_SECRET') || 'molinos_123',
    trustProxy: Number(env('TRUST_PROXY') ?? (oracle ? 1 : 0)), // nº de proxies delante (Caddy en el front = 1)
    tokenEnBody: process.env.TOKEN_EN_BODY === 'true', // solo transición: el token va en cookie httpOnly
    isProd,
    /** Orígenes extra permitidos por CORS (lista fija). Los de LAN en modo local se validan en app.ts. */
    corsOrigins: lista(env('CORS_ORIGINS') ?? env('FRONT_URL') ?? env('FRONTEND_URL')),
    cookieOpts: { httpOnly: true, secure: cookieSecure, sameSite: 'lax' as const, maxAge: 8 * 3600 * 1000 },
    storageDriver: (driver === 'minio' ? 'minio' : 'disco') as 'minio' | 'disco',
    storageDir: env('STORAGE_DIR') ?? './almacenamiento-local',
    minioEndpoint: env('MINIO_ENDPOINT') ?? (oracle ? 'minio' : '127.0.0.1'),
    minioPort: Number(env('MINIO_PORT') ?? 9000),
    minioSSL: bool('MINIO_SSL', false),
    minioAccessKey: env('MINIO_ACCESS_KEY') ?? '',
    minioSecretKey: env('MINIO_SECRET_KEY') ?? '',
    minioBucket: env('MINIO_BUCKET') ?? 'molinos-comprobantes',
    superAdmin: env('SUPER_ADMIN_USERNAME') ?? 'chris',
    frontendUrl: env('FRONT_URL') ?? env('FRONTEND_URL') ?? 'http://localhost:5173',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
};

/** Línea única de arranque: qué modo es y con qué se conecta (sin contraseñas). */
export function resumenArranque(): string {
    const alm = CONFIG.storageDriver === 'minio'
        ? `minio(${CONFIG.minioEndpoint}:${CONFIG.minioPort}/${CONFIG.minioBucket})`
        : `disco(${CONFIG.storageDir})`;
    const cors = CONFIG.corsOrigins.length ? CONFIG.corsOrigins.join(',') : '(ninguno fijo)';
    return `[molinos] modo=${CONFIG.modo} (${CONFIG.motivoModo}) · BD=${CONFIG.dbHost}:${CONFIG.dbPort}/${CONFIG.dbName} ssl=${CONFIG.dbSsl ? 'on' : 'off'} · almacenamiento=${alm} · cors=[${cors}${CONFIG.modo === 'local' ? ' + localhost/LAN' : ''}]`;
}
