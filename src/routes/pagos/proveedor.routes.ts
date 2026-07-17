import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const categoriaProveedorController = factory.pagos.getCategoriaProveedorController();

// Proveedor
router.get('/categorias', categoriaProveedorController.list);
router.get('/categorias/:id', categoriaProveedorController.getById);
router.post('/categorias', categoriaProveedorController.create);
router.put('/categorias/:id', categoriaProveedorController.update);
router.delete('/categorias/:id', categoriaProveedorController.delete);

export default router;
