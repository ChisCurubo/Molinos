import { Router } from 'express';
import { factory } from '../../config/factory';
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
