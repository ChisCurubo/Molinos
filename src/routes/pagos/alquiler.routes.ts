import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const tipoAlquilerController = factory.pagos.getTipoAlquilerController();

// Alquiler
router.get('/tipos', tipoAlquilerController.list);
router.get('/tipos/:id', tipoAlquilerController.getById);
router.post('/tipos', tipoAlquilerController.create);
router.put('/tipos/:id', tipoAlquilerController.update);
router.delete('/tipos/:id', tipoAlquilerController.delete);

export default router;
