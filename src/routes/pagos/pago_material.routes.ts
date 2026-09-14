import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const c = factory.pagos.getPagoMaterialController();

// Abonos (rutas específicas primero, antes de /:id)
router.get('/abonos', c.listarAbonos);
router.patch('/abonos/:idAbono', c.actualizarAbono);
router.delete('/abonos/:idAbono', c.eliminarAbono);

// Cuentas de grupo (material)
router.post('/', c.crearCuenta);
router.get('/', c.listar);
router.get('/:id', c.detalle);
router.patch('/:id', c.actualizarCuenta);
router.delete('/:id', c.anularCuenta);
router.post('/:id/abonos', c.registrarAbono);

export default router;
