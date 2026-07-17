import { Pool } from 'mysql2/promise';
import { TipoAlquilerRepository } from '../../repositories/pagos/alquiler.repository';
import { CategoriaCxCRepository } from '../../repositories/pagos/cxc.repository';
import { MySQLCuentasPorPagarRepo, CategoriaCxPRepository } from '../../repositories/pagos/cxp.repository';
import { TipoGastoOperativoRepository } from '../../repositories/pagos/gasto.repository';
import { CategoriaProveedorRepository } from '../../repositories/pagos/proveedor.repository';
import { DeudaRepository } from '../../repositories/pagos/deuda.repository';
import { VEstadoAlquileresRepository, VEstadoCombustibleRepository, VEstadoMulasRepository, VSaldosAFavorRepository } from '../../repositories/pagos/views/vistas.pagos.repository';
import { TipoAlquilerService } from '../../services/pagos/alquiler.service';
import { CategoriaCxCService } from '../../services/pagos/cxc.service';
import { CuentasPorPagarService, CategoriaCxPService } from '../../services/pagos/cxp.service';
import { TipoGastoOperativoService } from '../../services/pagos/gasto.service';
import { CategoriaProveedorService } from '../../services/pagos/proveedor.service';
import { TipoAlquilerController } from '../../controllers/pagos/alquiler.controller';
import { CategoriaCxCController } from '../../controllers/pagos/cxc.controller';
import { CuentasPorPagarController, CategoriaCxPController } from '../../controllers/pagos/cxp.controller';
import { TipoGastoOperativoController } from '../../controllers/pagos/gasto.controller';
import { CategoriaProveedorController } from '../../controllers/pagos/proveedor.controller';
import { DeudaController } from '../../controllers/pagos/deuda.controller';
import { PrestamoFinancieroRepository } from '../../repositories/pagos/prestamo_financiero.repository';
import { PrestamoFinancieroService } from '../../services/pagos/prestamo_financiero.service';
import { PrestamoFinancieroController } from '../../controllers/pagos/prestamo_financiero.controller';

export class PagosFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private tipoAlquilerRepository?: TipoAlquilerRepository;
    private categoriaCxCRepository?: CategoriaCxCRepository;
    private cuentasPorPagarRepository?: MySQLCuentasPorPagarRepo;
    private categoriaCxPRepository?: CategoriaCxPRepository;
    private tipoGastoOperativoRepository?: TipoGastoOperativoRepository;
    private categoriaProveedorRepository?: CategoriaProveedorRepository;
    private deudaRepository?: DeudaRepository;
    private vEstadoAlquileresRepository?: VEstadoAlquileresRepository;
    private vEstadoCombustibleRepository?: VEstadoCombustibleRepository;
    private vEstadoMulasRepository?: VEstadoMulasRepository;
    private vSaldosAFavorRepository?: VSaldosAFavorRepository;

    private tipoAlquilerService?: TipoAlquilerService;
    private categoriaCxCService?: CategoriaCxCService;
    private cuentasPorPagarService?: CuentasPorPagarService;
    private categoriaCxPService?: CategoriaCxPService;
    private tipoGastoOperativoService?: TipoGastoOperativoService;
    private categoriaProveedorService?: CategoriaProveedorService;

    private tipoAlquilerController?: TipoAlquilerController;
    private categoriaCxCController?: CategoriaCxCController;
    private cuentasPorPagarController?: CuentasPorPagarController;
    private categoriaCxPController?: CategoriaCxPController;
    private tipoGastoOperativoController?: TipoGastoOperativoController;
    private categoriaProveedorController?: CategoriaProveedorController;
    private deudaController?: DeudaController;
    private prestamoFinancieroRepository?: PrestamoFinancieroRepository;
    private prestamoFinancieroService?: PrestamoFinancieroService;
    private prestamoFinancieroController?: PrestamoFinancieroController;

    public getTipoAlquilerRepository(): TipoAlquilerRepository {
        if (!this.tipoAlquilerRepository) this.tipoAlquilerRepository = new TipoAlquilerRepository(this.db);
        return this.tipoAlquilerRepository;
    }

    public getCategoriaCxCRepository(): CategoriaCxCRepository {
        if (!this.categoriaCxCRepository) this.categoriaCxCRepository = new CategoriaCxCRepository(this.db);
        return this.categoriaCxCRepository;
    }

    public getCuentasPorPagarRepository(): MySQLCuentasPorPagarRepo {
        if (!this.cuentasPorPagarRepository) this.cuentasPorPagarRepository = new MySQLCuentasPorPagarRepo(this.db);
        return this.cuentasPorPagarRepository;
    }

    public getCategoriaCxPRepository(): CategoriaCxPRepository {
        if (!this.categoriaCxPRepository) this.categoriaCxPRepository = new CategoriaCxPRepository(this.db);
        return this.categoriaCxPRepository;
    }

    public getTipoGastoOperativoRepository(): TipoGastoOperativoRepository {
        if (!this.tipoGastoOperativoRepository) this.tipoGastoOperativoRepository = new TipoGastoOperativoRepository(this.db);
        return this.tipoGastoOperativoRepository;
    }

    public getCategoriaProveedorRepository(): CategoriaProveedorRepository {
        if (!this.categoriaProveedorRepository) this.categoriaProveedorRepository = new CategoriaProveedorRepository(this.db);
        return this.categoriaProveedorRepository;
    }

    public getDeudaRepository(): DeudaRepository {
        if (!this.deudaRepository) this.deudaRepository = new DeudaRepository(this.db);
        return this.deudaRepository;
    }

    public getVEstadoAlquileresRepository(): VEstadoAlquileresRepository {
        if (!this.vEstadoAlquileresRepository) this.vEstadoAlquileresRepository = new VEstadoAlquileresRepository(this.db);
        return this.vEstadoAlquileresRepository;
    }

    public getVEstadoCombustibleRepository(): VEstadoCombustibleRepository {
        if (!this.vEstadoCombustibleRepository) this.vEstadoCombustibleRepository = new VEstadoCombustibleRepository(this.db);
        return this.vEstadoCombustibleRepository;
    }

    public getVEstadoMulasRepository(): VEstadoMulasRepository {
        if (!this.vEstadoMulasRepository) this.vEstadoMulasRepository = new VEstadoMulasRepository(this.db);
        return this.vEstadoMulasRepository;
    }

    public getVSaldosAFavorRepository(): VSaldosAFavorRepository {
        if (!this.vSaldosAFavorRepository) this.vSaldosAFavorRepository = new VSaldosAFavorRepository(this.db);
        return this.vSaldosAFavorRepository;
    }

    public getTipoAlquilerService(): TipoAlquilerService {
        if (!this.tipoAlquilerService) this.tipoAlquilerService = new TipoAlquilerService(this.getTipoAlquilerRepository());
        return this.tipoAlquilerService;
    }

    public getCategoriaCxCService(): CategoriaCxCService {
        if (!this.categoriaCxCService) this.categoriaCxCService = new CategoriaCxCService(this.getCategoriaCxCRepository());
        return this.categoriaCxCService;
    }

    public getCuentasPorPagarService(): CuentasPorPagarService {
        if (!this.cuentasPorPagarService) this.cuentasPorPagarService = new CuentasPorPagarService(this.getCuentasPorPagarRepository());
        return this.cuentasPorPagarService;
    }

    public getCategoriaCxPService(): CategoriaCxPService {
        if (!this.categoriaCxPService) this.categoriaCxPService = new CategoriaCxPService(this.getCategoriaCxPRepository());
        return this.categoriaCxPService;
    }

    public getTipoGastoOperativoService(): TipoGastoOperativoService {
        if (!this.tipoGastoOperativoService) this.tipoGastoOperativoService = new TipoGastoOperativoService(this.getTipoGastoOperativoRepository());
        return this.tipoGastoOperativoService;
    }

    public getCategoriaProveedorService(): CategoriaProveedorService {
        if (!this.categoriaProveedorService) this.categoriaProveedorService = new CategoriaProveedorService(this.getCategoriaProveedorRepository());
        return this.categoriaProveedorService;
    }

    public getTipoAlquilerController(): TipoAlquilerController {
        if (!this.tipoAlquilerController) this.tipoAlquilerController = new TipoAlquilerController(this.getTipoAlquilerService());
        return this.tipoAlquilerController;
    }

    public getCategoriaCxCController(): CategoriaCxCController {
        if (!this.categoriaCxCController) this.categoriaCxCController = new CategoriaCxCController(this.getCategoriaCxCService());
        return this.categoriaCxCController;
    }

    public getCuentasPorPagarController(): CuentasPorPagarController {
        if (!this.cuentasPorPagarController) this.cuentasPorPagarController = new CuentasPorPagarController(this.getCuentasPorPagarService());
        return this.cuentasPorPagarController;
    }

    public getCategoriaCxPController(): CategoriaCxPController {
        if (!this.categoriaCxPController) this.categoriaCxPController = new CategoriaCxPController(this.getCategoriaCxPService());
        return this.categoriaCxPController;
    }

    public getTipoGastoOperativoController(): TipoGastoOperativoController {
        if (!this.tipoGastoOperativoController) this.tipoGastoOperativoController = new TipoGastoOperativoController(this.getTipoGastoOperativoService());
        return this.tipoGastoOperativoController;
    }

    public getCategoriaProveedorController(): CategoriaProveedorController {
        if (!this.categoriaProveedorController) this.categoriaProveedorController = new CategoriaProveedorController(this.getCategoriaProveedorService());
        return this.categoriaProveedorController;
    }

    public getDeudaController(): DeudaController {
        if (!this.deudaController) this.deudaController = new DeudaController(
            this.getDeudaRepository(),
            this.getVEstadoAlquileresRepository(),
            this.getVEstadoCombustibleRepository(),
            this.getVEstadoMulasRepository(),
            this.getVSaldosAFavorRepository()
        );
        return this.deudaController;
    }


    public getPrestamoFinancieroRepository(): PrestamoFinancieroRepository {
        if (!this.prestamoFinancieroRepository) this.prestamoFinancieroRepository = new PrestamoFinancieroRepository(this.db);
        return this.prestamoFinancieroRepository;
    }

    public getPrestamoFinancieroService(): PrestamoFinancieroService {
        if (!this.prestamoFinancieroService) this.prestamoFinancieroService = new PrestamoFinancieroService(this.getPrestamoFinancieroRepository());
        return this.prestamoFinancieroService;
    }

    public getPrestamoFinancieroController(): PrestamoFinancieroController {
        if (!this.prestamoFinancieroController) this.prestamoFinancieroController = new PrestamoFinancieroController(this.getPrestamoFinancieroService());
        return this.prestamoFinancieroController;
    }
}
