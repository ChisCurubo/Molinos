import { Router } from 'express';
import Database from '../config/database.config';
import { CONFIG } from '../config/config';
import { factory } from '../config/factory';

/**
 * GET /api/v1/health — SIN sesión: lo usan el healthcheck de Docker, Caddy y el arranque (setup-back.sh).
 * Siempre responde 200: solo INFORMA el estado (db/almacenamiento). No expone host, usuario ni claves.
 */
const router = Router();
const conTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

router.get('/', async (_req, res) => {
    const db = await conTimeout(Database.getInstance().query('SELECT 1'), 3000).then(() => 'ok' as const, () => 'error' as const);
    const almacenamiento = await conTimeout(factory.archivos.getArchivoService().estado(), 3000)
        .then(({ driver, ok }) => ({ driver, ok }), () => ({ driver: CONFIG.storageDriver, ok: false }));
    res.json({ success: true, data: { modo: CONFIG.modo, db, almacenamiento, hora: new Date().toISOString() } });
});

export default router;
