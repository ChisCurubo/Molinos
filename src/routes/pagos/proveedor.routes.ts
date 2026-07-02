import { Router } from 'express';
import { CategoriaProveedorController } from '../../controllers/pagos/proveedor.controller';

const router = Router();
const categoriaProveedorController = new CategoriaProveedorController();

// Proveedor
router.get('/categorias', categoriaProveedorController.list);
router.get('/categorias/:id', categoriaProveedorController.getById);
router.post('/categorias', categoriaProveedorController.create);
router.put('/categorias/:id', categoriaProveedorController.update);
router.delete('/categorias/:id', categoriaProveedorController.delete);

export default router;
