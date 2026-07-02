import { Router } from 'express';
import { TipoAlquilerController } from '../../controllers/pagos/alquiler.controller';

const router = Router();
const tipoAlquilerController = new TipoAlquilerController();

// Alquiler
router.get('/tipos', tipoAlquilerController.list);
router.get('/tipos/:id', tipoAlquilerController.getById);
router.post('/tipos', tipoAlquilerController.create);
router.put('/tipos/:id', tipoAlquilerController.update);
router.delete('/tipos/:id', tipoAlquilerController.delete);

export default router;
