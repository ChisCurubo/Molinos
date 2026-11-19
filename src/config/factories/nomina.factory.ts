import { Pool } from 'mysql2/promise';
import { EmpleadoRepository, PrestamoEmpleadoRepository } from '../../repositories/nomina/empleado.repository';
import { EmpleadoSalarioRepository } from '../../repositories/nomina/empleado_salario.repository';
import { PlantaRepository } from '../../repositories/nomina/planta.repository';
import { TurnoRepository, TipoTurnoRepository } from '../../repositories/nomina/turno.repository';
import { NominaLiquidacionRepository } from '../../repositories/nomina/nomina_liquidacion.repository';
import { BonoEmpleadoRepository } from '../../repositories/nomina/bono_empleado.repository';
import { VSaldoPrestamosEmpleadoRepository } from '../../repositories/nomina/views/vistas.nomina.repository';
import { JornadaNocturnaLegalRepository } from '../../repositories/nomina/jornada_nocturna_legal.repository';
import { EmpleadoService, PrestamoEmpleadoService } from '../../services/nomina/empleado.service';
import { EmpleadoSalarioService } from '../../services/nomina/empleado_salario.service';
import { PlantaService } from '../../services/nomina/planta.service';
import { TurnoService, TipoTurnoService } from '../../services/nomina/turno.service';
import { NominaLiquidacionService } from '../../services/nomina/nomina_liquidacion.service';
import { BonoEmpleadoService } from '../../services/nomina/bono_empleado.service';
import { EmpleadoFichaService } from '../../services/nomina/empleado_ficha.service';
import { JornadaNocturnaLegalService } from '../../services/nomina/jornada_nocturna_legal.service';
import { EmpleadoController, PrestamoEmpleadoController } from '../../controllers/nomina/empleado.controller';
import { EmpleadoSalarioController } from '../../controllers/nomina/empleado_salario.controller';
import { PlantaController } from '../../controllers/nomina/planta.controller';
import { TurnoController, TipoTurnoController } from '../../controllers/nomina/turno.controller';
import { NominaLiquidacionController } from '../../controllers/nomina/nomina_liquidacion.controller';
import { BonoEmpleadoController } from '../../controllers/nomina/bono_empleado.controller';
import { EmpleadoFichaController } from '../../controllers/nomina/empleado_ficha.controller';
import { JornadaNocturnaLegalController } from '../../controllers/nomina/jornada_nocturna_legal.controller';

export class NominaFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private empleadoRepository?: EmpleadoRepository;
    private empleadoSalarioRepository?: EmpleadoSalarioRepository;
    private prestamoEmpleadoRepository?: PrestamoEmpleadoRepository;
    private plantaRepository?: PlantaRepository;
    private turnoRepository?: TurnoRepository;
    private tipoTurnoRepository?: TipoTurnoRepository;
    private vSaldoPrestamosEmpleadoRepository?: VSaldoPrestamosEmpleadoRepository;
    private nominaLiquidacionRepository?: NominaLiquidacionRepository;
    private bonoEmpleadoRepository?: BonoEmpleadoRepository;
    private jornadaNocturnaLegalRepository?: JornadaNocturnaLegalRepository;

    private empleadoService?: EmpleadoService;
    private empleadoSalarioService?: EmpleadoSalarioService;
    private prestamoEmpleadoService?: PrestamoEmpleadoService;
    private plantaService?: PlantaService;
    private turnoService?: TurnoService;
    private tipoTurnoService?: TipoTurnoService;
    private nominaLiquidacionService?: NominaLiquidacionService;
    private bonoEmpleadoService?: BonoEmpleadoService;
    private empleadoFichaService?: EmpleadoFichaService;
    private jornadaNocturnaLegalService?: JornadaNocturnaLegalService;

    private empleadoController?: EmpleadoController;
    private empleadoSalarioController?: EmpleadoSalarioController;
    private prestamoEmpleadoController?: PrestamoEmpleadoController;
    private plantaController?: PlantaController;
    private turnoController?: TurnoController;
    private tipoTurnoController?: TipoTurnoController;
    private nominaLiquidacionController?: NominaLiquidacionController;
    private bonoEmpleadoController?: BonoEmpleadoController;
    private empleadoFichaController?: EmpleadoFichaController;
    private jornadaNocturnaLegalController?: JornadaNocturnaLegalController;

    public getEmpleadoRepository(): EmpleadoRepository {
        if (!this.empleadoRepository) this.empleadoRepository = new EmpleadoRepository(this.db);
        return this.empleadoRepository;
    }

    public getEmpleadoSalarioRepository(): EmpleadoSalarioRepository {
        if (!this.empleadoSalarioRepository) this.empleadoSalarioRepository = new EmpleadoSalarioRepository(this.db);
        return this.empleadoSalarioRepository;
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

    public getNominaLiquidacionRepository(): NominaLiquidacionRepository {
        if (!this.nominaLiquidacionRepository) this.nominaLiquidacionRepository = new NominaLiquidacionRepository(this.db);
        return this.nominaLiquidacionRepository;
    }

    public getBonoEmpleadoRepository(): BonoEmpleadoRepository {
        if (!this.bonoEmpleadoRepository) this.bonoEmpleadoRepository = new BonoEmpleadoRepository(this.db);
        return this.bonoEmpleadoRepository;
    }

    public getJornadaNocturnaLegalRepository(): JornadaNocturnaLegalRepository {
        if (!this.jornadaNocturnaLegalRepository) this.jornadaNocturnaLegalRepository = new JornadaNocturnaLegalRepository(this.db);
        return this.jornadaNocturnaLegalRepository;
    }

    public getEmpleadoService(): EmpleadoService {
        if (!this.empleadoService) this.empleadoService = new EmpleadoService(this.getEmpleadoRepository());
        return this.empleadoService;
    }

    public getEmpleadoSalarioService(): EmpleadoSalarioService {
        if (!this.empleadoSalarioService) this.empleadoSalarioService = new EmpleadoSalarioService(this.getEmpleadoSalarioRepository(), this.db);
        return this.empleadoSalarioService;
    }

    public getPrestamoEmpleadoService(): PrestamoEmpleadoService {
        if (!this.prestamoEmpleadoService) this.prestamoEmpleadoService = new PrestamoEmpleadoService(this.getPrestamoEmpleadoRepository(), this.getEmpleadoRepository(), this.db);
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

    public getNominaLiquidacionService(): NominaLiquidacionService {
        if (!this.nominaLiquidacionService) this.nominaLiquidacionService = new NominaLiquidacionService(
            this.getNominaLiquidacionRepository(),
            this.getEmpleadoRepository(),
            this.getEmpleadoSalarioRepository(),
            this.getTurnoRepository(),
            this.getTipoTurnoRepository(),
            this.getPrestamoEmpleadoRepository(),
            this.getBonoEmpleadoRepository(),
            this.getJornadaNocturnaLegalRepository(),
            this.db
        );
        return this.nominaLiquidacionService;
    }

    public getJornadaNocturnaLegalService(): JornadaNocturnaLegalService {
        if (!this.jornadaNocturnaLegalService) this.jornadaNocturnaLegalService = new JornadaNocturnaLegalService(this.getJornadaNocturnaLegalRepository());
        return this.jornadaNocturnaLegalService;
    }

    public getBonoEmpleadoService(): BonoEmpleadoService {
        if (!this.bonoEmpleadoService) this.bonoEmpleadoService = new BonoEmpleadoService(this.getBonoEmpleadoRepository(), this.getEmpleadoRepository(), this.db);
        return this.bonoEmpleadoService;
    }

    public getEmpleadoFichaService(): EmpleadoFichaService {
        if (!this.empleadoFichaService) this.empleadoFichaService = new EmpleadoFichaService(
            this.getEmpleadoRepository(),
            this.getEmpleadoSalarioRepository(),
            this.getPrestamoEmpleadoRepository(),
            this.getBonoEmpleadoRepository(),
            this.getNominaLiquidacionService()
        );
        return this.empleadoFichaService;
    }

    public getEmpleadoController(): EmpleadoController {
        if (!this.empleadoController) this.empleadoController = new EmpleadoController(this.getEmpleadoService());
        return this.empleadoController;
    }

    public getEmpleadoSalarioController(): EmpleadoSalarioController {
        if (!this.empleadoSalarioController) this.empleadoSalarioController = new EmpleadoSalarioController(this.getEmpleadoSalarioService());
        return this.empleadoSalarioController;
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

    public getNominaLiquidacionController(): NominaLiquidacionController {
        if (!this.nominaLiquidacionController) this.nominaLiquidacionController = new NominaLiquidacionController(this.getNominaLiquidacionService());
        return this.nominaLiquidacionController;
    }

    public getBonoEmpleadoController(): BonoEmpleadoController {
        if (!this.bonoEmpleadoController) this.bonoEmpleadoController = new BonoEmpleadoController(this.getBonoEmpleadoService());
        return this.bonoEmpleadoController;
    }

    public getEmpleadoFichaController(): EmpleadoFichaController {
        if (!this.empleadoFichaController) this.empleadoFichaController = new EmpleadoFichaController(this.getEmpleadoFichaService());
        return this.empleadoFichaController;
    }

    public getJornadaNocturnaLegalController(): JornadaNocturnaLegalController {
        if (!this.jornadaNocturnaLegalController) this.jornadaNocturnaLegalController = new JornadaNocturnaLegalController(this.getJornadaNocturnaLegalService());
        return this.jornadaNocturnaLegalController;
    }

    // ==========================================
}
