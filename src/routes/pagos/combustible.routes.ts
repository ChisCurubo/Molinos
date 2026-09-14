import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const c = factory.pagos.getCombustibleController();

// Rutas específicas antes de /:id
router.get('/dueno/:id/neto-flete', c.netoFletePorDueno);

router.get('/', c.listar);
router.get('/:id', c.obtener);

export default router;
