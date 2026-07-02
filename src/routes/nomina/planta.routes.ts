import { Router } from 'express';
import { PlantaController } from '../../controllers/nomina/planta.controller';

const router = Router();
const plantaController = new PlantaController();

// Rutas Plantas
router.get('/', plantaController.list);
router.get('/:id', plantaController.getById);
router.post('/', plantaController.create);
router.put('/:id', plantaController.update);
router.delete('/:id', plantaController.delete);

export default router;
