import { Router } from 'express';
import { TurnoController, TipoTurnoController } from '../../controllers/nomina/turno.controller';

const router = Router();

const turnoController = new TurnoController();
const tipoTurnoController = new TipoTurnoController();

// Rutas Turnos
router.get('/', turnoController.list);
router.get('/:id', turnoController.getById);
router.post('/', turnoController.create);
router.put('/:id', turnoController.update);
router.delete('/:id', turnoController.delete);

// Rutas Tipos de Turno
router.get('/tipos', tipoTurnoController.list);
router.get('/tipos/:id', tipoTurnoController.getById);
router.post('/tipos', tipoTurnoController.create);
router.put('/tipos/:id', tipoTurnoController.update);
router.delete('/tipos/:id', tipoTurnoController.delete);

export default router;
