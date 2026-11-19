import { Router } from 'express';
import { factory } from '../../config/factory';
import { CODIGOS } from '../../errors/codigos';
import { CacheService } from '../../services/cache/cache.service';

const router = Router();
const ctrl = factory.info.getInfoController();

/**
 * @swagger
 * tags:
 *   name: Info
 *   description: Información general de la API y utilidades
 */

/**
 * @swagger
 * /info:
 *   get:
 *     summary: Mapa de la API
 *     tags: [Info]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Estructura y endpoints de la API
 */
router.get('/',             ctrl.apiMap);

/**
 * @swagger
 * /info/errores:
 *   get:
 *     summary: Catálogo de códigos de error (contrato con el front)
 *     description: Cada respuesta de error trae `code`; aquí está su estado HTTP, significado y qué debe hacer el front.
 *     tags: [Info]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de códigos
 */
router.get('/errores', (_req, res) => {
    res.json({ success: true, data: Object.entries(CODIGOS).map(([code, d]) => ({ code, ...d })) });
});

/**
 * @swagger
 * /info/estadisticas:
 *   get:
 *     summary: Estadísticas generales del sistema
 *     tags: [Info]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Estadísticas
 */
router.get('/estadisticas', ctrl.estadisticas);

/**
 * @swagger
 * /info/health:
 *   get:
 *     summary: Verificación de estado
 *     tags: [Info]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OK si el sistema está operativo
 */
router.get('/health',       ctrl.health);

/**
 * @swagger
 * /info/catalogos:
 *   get:
 *     summary: Catálogos en memoria (minas, mineros, zonas, dueños de volqueta)
 *     tags: [Info]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Catálogos
 */
router.get('/catalogos',    ctrl.getCatalogos);

export default router;
