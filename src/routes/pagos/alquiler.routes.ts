import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const tipoAlquilerController = factory.pagos.getTipoAlquilerController();
const alquilerController = factory.pagos.getAlquilerController();
const pagoAlquilerController = factory.pagos.getPagoAlquilerController();
const contratoAlquilerController = factory.pagos.getContratoAlquilerController();

// Tipos de Alquiler (catálogo)
router.get('/tipos', tipoAlquilerController.list);
router.get('/tipos/:id', tipoAlquilerController.getById);
router.post('/tipos', tipoAlquilerController.create);
router.put('/tipos/:id', tipoAlquilerController.update);
router.delete('/tipos/:id', tipoAlquilerController.delete);

// Abonos de alquiler (rutas específicas antes de /:id)
router.get('/abonos', pagoAlquilerController.listarAbonos);
router.patch('/abonos/:idAbono', pagoAlquilerController.actualizarAbono);
router.delete('/abonos/:idAbono', pagoAlquilerController.eliminarAbono);

// Contratos de arriendo de larga duración (ej. 1 año) — al crearse generan automáticamente
// un Alquileres (cobro mensual) por cada mes del período (rutas antes de /:id)
router.get('/contratos', contratoAlquilerController.list);
router.post('/contratos', contratoAlquilerController.create);
router.get('/contratos/:id', contratoAlquilerController.getById);
router.put('/contratos/:id', contratoAlquilerController.update);
router.delete('/contratos/:id', contratoAlquilerController.delete);

// CRUD del alquiler (cobro mensual puntual — generado por un contrato o creado suelto)
router.get('/', alquilerController.list);
router.post('/', alquilerController.create);
router.get('/:id', alquilerController.getById);
router.put('/:id', alquilerController.update);
router.delete('/:id', alquilerController.delete);

// Pago de un alquiler puntual
router.get('/:id/estado-pago', pagoAlquilerController.estado);
router.post('/:id/abonos', pagoAlquilerController.registrarAbono);

export default router;
