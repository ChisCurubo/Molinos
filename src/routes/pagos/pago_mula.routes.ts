import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const c = factory.pagos.getPagoMulaController();

// Abonos y rutas específicas (antes de /:id)
router.get('/abonos', c.listarAbonos);
router.patch('/abonos/:idAbono', c.actualizarAbono);
router.delete('/abonos/:idAbono', c.eliminarAbono);
router.post('/proveedor/:idProveedor/abonos', c.registrarAbonoProveedor);
router.get('/resumen', c.resumen);
router.get('/viajes', c.trazabilidadViajes);

// CRUD del despacho
router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.detalle);
router.patch('/:id', c.actualizar);
router.delete('/:id', c.eliminar);

export default router;
