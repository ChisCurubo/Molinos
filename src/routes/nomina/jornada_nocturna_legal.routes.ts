import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const ctrl = factory.nomina.getJornadaNocturnaLegalController();

/**
 * @swagger
 * tags:
 *   name: JornadaNocturnaLegal
 *   description: Histórico del corte legal de jornada nocturna (Ley 2101 de 2021)
 */

/**
 * @swagger
 * /nomina/jornada-nocturna-legal:
 *   get:
 *     summary: Listar el histórico de cortes de jornada nocturna
 *     tags: [JornadaNocturnaLegal]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Histórico completo, más reciente primero }
 */
router.get('/', ctrl.listar);

/**
 * @swagger
 * /nomina/jornada-nocturna-legal:
 *   post:
 *     summary: Registrar un nuevo corte de jornada nocturna (cuando la ley vuelva a moverlo)
 *     tags: [JornadaNocturnaLegal]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hora_inicio_nocturno, vigente_desde]
 *             properties:
 *               hora_inicio_nocturno: { type: string, example: '19:00' }
 *               vigente_desde: { type: string, format: date }
 *     responses:
 *       201: { description: Corte creado }
 *       409: { description: Ya existe un corte vigente desde esa fecha }
 */
router.post('/', ctrl.crear);

export default router;
