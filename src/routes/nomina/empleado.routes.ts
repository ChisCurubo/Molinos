import { Router } from 'express';
import { EmpleadoController, PrestamoEmpleadoController } from '../../controllers/nomina/empleado.controller';
import { EmpleadoRepository } from '../../repositories/nomina/empleado.repository';
import { MySQLPrestamoEmpleadoRepo } from '../../repositories/nomina/empleado.repository';
import { PrestamoEmpleadoService } from '../../services/nomina/empleado.service';

const router = Router();

const empleadoController = new EmpleadoController();

// Init Prestamo Empleado
const prestamoRepo = new MySQLPrestamoEmpleadoRepo();
const empleadoRepo = new EmpleadoRepository() as any; 
const prestamoService = new PrestamoEmpleadoService(prestamoRepo, empleadoRepo);
const prestamoController = new PrestamoEmpleadoController(prestamoService);

// Rutas Empleados
router.get('/', empleadoController.list);
router.get('/:id', empleadoController.getById);
router.post('/', empleadoController.create);
router.put('/:id', empleadoController.update);
router.delete('/:id', empleadoController.delete);

// Rutas Prestamos
router.post('/prestamos', prestamoController.registrar.bind(prestamoController));
router.get('/prestamos/:idEmpleado', prestamoController.listarPorEmpleado.bind(prestamoController));

export default router;
