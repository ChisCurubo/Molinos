import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const productoController = factory.inventarioProductos.getProductoController();
const movimientoController = factory.inventarioProductos.getMovimientoController();
const resumenController = factory.inventarioProductos.getResumenController();

router.get('/resumen', resumenController.resumen);

router.get('/productos', productoController.list);
router.post('/productos', productoController.create);
router.get('/productos/:id', productoController.getById);
router.put('/productos/:id', productoController.update);
router.delete('/productos/:id', productoController.delete);

router.get('/movimientos', movimientoController.list);
router.post('/movimientos', movimientoController.create);
router.delete('/movimientos/:id', movimientoController.delete);

export default router;
