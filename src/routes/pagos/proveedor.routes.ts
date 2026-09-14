import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const categoriaProveedorController = factory.pagos.getCategoriaProveedorController();
const proveedorController = factory.pagos.getProveedorController();

// Categorías de proveedor (rutas específicas antes de /:id de Proveedores)
router.get('/categorias', categoriaProveedorController.list);
router.get('/categorias/:id', categoriaProveedorController.getById);
router.post('/categorias', categoriaProveedorController.create);
router.put('/categorias/:id', categoriaProveedorController.update);
router.delete('/categorias/:id', categoriaProveedorController.delete);

// Proveedores (la entidad real: transportadoras de mula, laboratorios, gasolineras, etc.)
router.get('/', proveedorController.list);
router.post('/', proveedorController.create);
router.get('/:id', proveedorController.getById);
router.put('/:id', proveedorController.update);
router.delete('/:id', proveedorController.delete);

export default router;
