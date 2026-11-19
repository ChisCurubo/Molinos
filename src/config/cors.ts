import { CorsOptions } from 'cors';
import { CONFIG } from './config';

/**
 * CORS por función `origin` (no lista plana). El front llama a la API por el MISMO dominio (/api/v1: proxy de
 * Caddy en Oracle, proxy de Vite en local), así que casi nunca hace falta; esto cubre accesos directos.
 *  - Sin cabecera Origin (curl, Postman, healthcheck, proxy) -> permitido.
 *  - oracle: solo CORS_ORIGINS/FRONT_URL + la VM del front (10.0.1.20). NUNCA comodines tipo *.sslip.io.
 *  - local : localhost y las IP de LAN en los puertos de Vite (5173/4173) y 8080, para probar desde el celular.
 *  - Origen rechazado: sin cabeceras CORS (el navegador lo bloquea) y 1 log por origen; nunca un 500.
 */
const PUERTOS_LOCAL = [5173, 4173, 8080];
const FRONT_ORACLE = ['http://10.0.1.20', 'https://10.0.1.20'];

const esIpLan = (h: string): boolean => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (!m) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 192 && b === 168 || a === 10 || (a === 172 && b >= 16 && b <= 31);
};

function permitidoLocal(origin: string): boolean {
    let u: URL;
    try { u = new URL(origin); } catch { return false; }
    if (u.protocol !== 'http:') return false;
    const puerto = Number(u.port);
    if (!PUERTOS_LOCAL.includes(puerto)) return false;
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || esIpLan(u.hostname);
}

export function construirCors(): CorsOptions {
    const fijos = new Set<string>([...CONFIG.corsOrigins, ...(CONFIG.modo === 'oracle' ? FRONT_ORACLE : [])]);
    if (CONFIG.modo === 'oracle' && !CONFIG.corsOrigins.length) {
        console.warn('[cors] FRONT_URL sin definir: solo funcionan llamadas por el proxy del front');
    }
    const avisados = new Set<string>();
    return {
        credentials: true,
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            if (fijos.has(origin) || (CONFIG.modo === 'local' && permitidoLocal(origin))) return cb(null, true);
            if (!avisados.has(origin)) { avisados.add(origin); console.warn(`[cors] origen rechazado: ${origin}`); }
            return cb(null, false);
        },
    };
}
