import { Pool } from 'mysql2/promise';
import { EmpleadoRepository, PrestamoEmpleadoRepository } from '../../repositories/nomina/empleado.repository';
import { PlantaRepository } from '../../repositories/nomina/planta.repository';
import { TurnoRepository, TipoTurnoRepository } from '../../repositories/nomina/turno.repository';
import { VSaldoPrestamosEmpleadoRepository } from '../../repositories/nomina/views/vistas.nomina.repository';
import { EmpleadoService, PrestamoEmpleadoService } from '../../services/nomina/empleado.service';
import { PlantaService } from '../../services/nomina/planta.service';
import { TurnoService, TipoTurnoService } from '../../services/nomina/turno.service';
import { EmpleadoController, PrestamoEmpleadoController } from '../../controllers/nomina/empleado.controller';
import { PlantaController } from '../../controllers/nomina/planta.controller';
import { TurnoController, TipoTurnoController } from '../../controllers/nomina/turno.controller';

export class NominaFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private empleadoRepository?: EmpleadoRepository;
    private prestamoEmpleadoRepository?: PrestamoEmpleadoRepository;
    private plantaRepository?: PlantaRepository;
    private turnoRepository?: TurnoRepository;
    private tipoTurnoRepository?: TipoTurnoRepository;
    private vSaldoPrestamosEmpleadoRepository?: VSaldoPrestamosEmpleadoRepository;

    private empleadoService?: EmpleadoService;
    private prestamoEmpleadoService?: PrestamoEmpleadoService;
    private plantaService?: PlantaService;
    private turnoService?: TurnoService;
    private tipoTurnoService?: TipoTurnoService;

    private empleadoController?: EmpleadoController;
    private prestamoEmpleadoController?: PrestamoEmpleadoController;
    private plantaController?: PlantaController;
    private turnoController?: TurnoController;
    private tipoTurnoController?: TipoTurnoController;

    public getEmpleadoRepository(): EmpleadoRepository {
        if (!this.empleadoRepository) this.empleadoRepository = new EmpleadoRepository(this.db);
        return this.empleadoRepository;
    }

    public getPrestamoEmpleadoRepository(): PrestamoEmpleadoRepository {
        if (!this.prestamoEmpleadoRepository) this.prestamoEmpleadoRepository = new PrestamoEmpleadoRepository(this.db);
        return this.prestamoEmpleadoRepository;
    }

    public getPlantaRepository(): PlantaRepository {
        if (!this.plantaRepository) this.plantaRepository = new PlantaRepository(this.db);
        return this.plantaRepository;
    }

    public getTurnoRepository(): TurnoRepository {
        if (!this.turnoRepository) this.turnoRepository = new TurnoRepository(this.db);
        return this.turnoRepository;
    }

    public getTipoTurnoRepository(): TipoTurnoRepository {
        if (!this.tipoTurnoRepository) this.tipoTurnoRepository = new TipoTurnoRepository(this.db);
        return this.tipoTurnoRepository;
    }

    public getVSaldoPrestamosEmpleadoRepository(): VSaldoPrestamosEmpleadoRepository {
        if (!this.vSaldoPrestamosEmpleadoRepository) this.vSaldoPrestamosEmpleadoRepository = new VSaldoPrestamosEmpleadoRepository(this.db);
        return this.vSaldoPrestamosEmpleadoRepository;
    }

    public getEmpleadoService(): EmpleadoService {
        if (!this.empleadoService) this.empleadoService = new EmpleadoService(this.getEmpleadoRepository());
        return this.empleadoService;
    }

    public getPrestamoEmpleadoService(): PrestamoEmpleadoService {
        if (!this.prestamoEmpleadoService) this.prestamoEmpleadoService = new PrestamoEmpleadoService(this.getPrestamoEmpleadoRepository(), this.getEmpleadoRepository());
        return this.prestamoEmpleadoService;
    }

    public getPlantaService(): PlantaService {
        if (!this.plantaService) this.plantaService = new PlantaService(this.getPlantaRepository());
        return this.plantaService;
    }

    public getTurnoService(): TurnoService {
        if (!this.turnoService) this.turnoService = new TurnoService(this.getTurnoRepository());
        return this.turnoService;
    }

    public getTipoTurnoService(): TipoTurnoService {
        if (!this.tipoTurnoService) this.tipoTurnoService = new TipoTurnoService(this.getTipoTurnoRepository());
        return this.tipoTurnoService;
    }

    public getEmpleadoController(): EmpleadoController {
        if (!this.empleadoController) this.empleadoController = new EmpleadoController(this.getEmpleadoService());
        return this.empleadoController;
    }

    public getPrestamoEmpleadoController(): PrestamoEmpleadoController {
        if (!this.prestamoEmpleadoController) this.prestamoEmpleadoController = new PrestamoEmpleadoController(this.getPrestamoEmpleadoService());
        return this.prestamoEmpleadoController;
    }

    public getPlantaController(): PlantaController {
        if (!this.plantaController) this.plantaController = new PlantaController(this.getPlantaService());
        return this.plantaController;
    }

    public getTurnoController(): TurnoController {
        if (!this.turnoController) this.turnoController = new TurnoController(this.getTurnoService());
        return this.turnoController;
    }

    public getTipoTurnoController(): TipoTurnoController {
        if (!this.tipoTurnoController) this.tipoTurnoController = new TipoTurnoController(this.getTipoTurnoService());
        return this.tipoTurnoController;
    }

    // ==========================================
}
