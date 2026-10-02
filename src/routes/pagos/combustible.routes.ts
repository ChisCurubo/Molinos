import { Router } from 'express';
import { factory } from '../../config/factory';
import pagoCombustibleRoutes from './pago_combustible.routes';

const router = Router();
const c = factory.pagos.getCombustibleController();

// Pago a la gasolinera (CxP agrupada por gasolinera+mes, cascada de abonos) — igual a Flete/Agua,
// pero anidado aquí (no como módulo top-level) porque comparte la entidad Combustible.
router.use('/pagos', pagoCombustibleRoutes);

// Rutas específicas antes de /:id
router.get('/dueno/:id/neto-flete', c.netoFletePorDueno);
router.get('/resumen-mensual', c.resumenMensual);
router.get('/kpis', c.kpis);

router.get('/', c.listar);
router.post('/', c.registrar);
router.get('/:id', c.obtener);
router.put('/:id', c.editar);
router.delete('/:id', c.eliminar);

export default router;
