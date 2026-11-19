import os from 'os';
import dotenv from 'dotenv';
dotenv.config(); // APP_MODE puede venir del .env; debe cargarse antes de detectar el modo

/**
 * MODO DE EJECUCIÓN, detectado solo:
 *   - 'oracle': servidor en Oracle Cloud (BD HeatWave, MinIO, HTTPS por Caddy).
 *   - 'local' : la PC de desarrollo (BD local, archivos en disco).
 *
 * Orden de decisión:
 *   1. `APP_MODE` ('oracle' | 'local') si viene: manda siempre.
 *   2. Si alguna interfaz IPv4 de esta máquina es la IP privada del back (`ORACLE_BACK_IP`, por defecto 10.0.1.10) -> oracle.
 *   3. Cualquier otra cosa (localhost, 192.168.x.x, 172.16-31.x, otra 10.x) -> local.
 *
 * IMPORTANTE: DENTRO de Docker la interfaz es 172.x (red del contenedor), nunca 10.0.1.10. Por eso el
 * docker-compose del servidor pasa `APP_MODE=oracle` explícito. La detección por IP solo sirve si algún día
 * se corre con `node`/`pm2` directamente en la VM.
 */
export type Modo = 'oracle' | 'local';

export const IP_BACK_ORACLE = process.env.ORACLE_BACK_IP || '10.0.1.10';

/** Separado de las constantes para poder probarlo con interfaces simuladas (scripts/probar-entorno.ts). */
export function detectarModo(
    env: NodeJS.ProcessEnv = process.env,
    interfaces: ReturnType<typeof os.networkInterfaces> = os.networkInterfaces(),
): { modo: Modo; motivo: string } {
    const forzado = (env.APP_MODE ?? '').trim().toLowerCase();
    if (forzado === 'oracle' || forzado === 'local') return { modo: forzado, motivo: 'APP_MODE' };
    if (forzado) console.warn(`[molinos] APP_MODE="${env.APP_MODE}" no es válido (use oracle|local): se detecta por IP`);

    const ip = env.ORACLE_BACK_IP || '10.0.1.10';
    const tiene = Object.values(interfaces).flat().some(i => i && i.family === 'IPv4' && i.address === ip);
    return tiene ? { modo: 'oracle', motivo: `IP ${ip}` } : { modo: 'local', motivo: 'sin IP del servidor' };
}

const det = detectarModo();
export const MODO: Modo = det.modo;
export const MOTIVO_MODO: string = det.motivo;
