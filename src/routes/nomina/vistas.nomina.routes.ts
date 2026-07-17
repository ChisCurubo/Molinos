import { Router } from 'express';
import { factory } from '../../config/factory';
import { Request, Response } from 'express';

const router = Router();
const repo = factory.nomina.getVSaldoPrestamosEmpleadoRepository();
const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any) => res.status(500).json({ success: false, error: e.message || String(e) });

/**
 * @swagger
 * tags:
 *   name: Vistas Nómina
 *   description: Vistas y reportes del módulo de nómina
 */

/**
 * @swagger
 * /nomina/vistas/saldo-prestamos-empleado:
 *   get:
 *     summary: Saldo de préstamos
 *     tags: [Vistas Nómina]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de saldos
 */
router.get('/saldo-prestamos-empleado',
    async (_req: Request, res: Response) => { try { ok(res, await repo.findAll()); } catch(e) { err(res, e); } }
);

/**
 * @swagger
 * /nomina/vistas/saldo-prestamos-empleado/{id_empleado}:
 *   get:
 *     summary: Saldo de préstamos de un empleado
 *     tags: [Vistas Nómina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_empleado
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Saldo del empleado
 */
router.get('/saldo-prestamos-empleado/:id_empleado',
    async (req: Request, res: Response) => { try { ok(res, await repo.findByEmpleado(Number(req.params.id_empleado))); } catch(e) { err(res, e); } }
);

export default router;
