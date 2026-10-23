import { Pool } from 'mysql2/promise';
import { TipoAlquilerRepository, AlquilerRepository } from '../../repositories/pagos/alquiler.repository';
import { PagoAlquilerRepository } from '../../repositories/pagos/pago_alquiler.repository';
import { ContratoAlquilerRepository } from '../../repositories/pagos/contrato_alquiler.repository';
import { GastoDirectoRepository } from '../../repositories/pagos/gasto_directo.repository';
import { CategoriaCxCRepository, MySQLCuentasPorCobrarRepo } from '../../repositories/pagos/cxc.repository';
import { MySQLCuentasPorPagarRepo, CategoriaCxPRepository } from '../../repositories/pagos/cxp.repository';
import { TipoGastoOperativoRepository } from '../../repositories/pagos/gasto.repository';
import { CategoriaProveedorRepository, ProveedorRepository } from '../../repositories/pagos/proveedor.repository';
import { DeudaRepository } from '../../repositories/pagos/deuda.repository';
import { VEstadoAlquileresRepository, VEstadoCombustibleRepository, VEstadoMulasRepository, VSaldosAFavorRepository } from '../../repositories/pagos/views/vistas.pagos.repository';
import { TipoAlquilerService, AlquilerService } from '../../services/pagos/alquiler.service';
import { PagoAlquilerService } from '../../services/pagos/pago_alquiler.service';
import { ContratoAlquilerService } from '../../services/pagos/contrato_alquiler.service';
import { GastoDirectoService } from '../../services/pagos/gasto_directo.service';
import { CategoriaCxCService, CuentasPorCobrarService } from '../../services/pagos/cxc.service';
import { CuentasPorPagarService, CategoriaCxPService } from '../../services/pagos/cxp.service';
import { TipoGastoOperativoService } from '../../services/pagos/gasto.service';
import { CategoriaProveedorService, ProveedorService } from '../../services/pagos/proveedor.service';
import { TipoAlquilerController, AlquilerController } from '../../controllers/pagos/alquiler.controller';
import { PagoAlquilerController } from '../../controllers/pagos/pago_alquiler.controller';
import { ContratoAlquilerController } from '../../controllers/pagos/contrato_alquiler.controller';
import { GastoDirectoController } from '../../controllers/pagos/gasto_directo.controller';
import { CategoriaCxCController, CuentasPorCobrarController } from '../../controllers/pagos/cxc.controller';
import { CuentasPorPagarController, CategoriaCxPController } from '../../controllers/pagos/cxp.controller';
import { TipoGastoOperativoController } from '../../controllers/pagos/gasto.controller';
import { CategoriaProveedorController, ProveedorController } from '../../controllers/pagos/proveedor.controller';
import { DeudaController } from '../../controllers/pagos/deuda.controller';
import { DeudaService } from '../../services/pagos/deuda.service';
import { PrestamoFinancieroRepository } from '../../repositories/pagos/prestamo_financiero.repository';
import { PrestamoFinancieroService } from '../../services/pagos/prestamo_financiero.service';
import { PrestamoFinancieroController } from '../../controllers/pagos/prestamo_financiero.controller';
import { IngresoTesoreriaRepository } from '../../repositories/pagos/ingreso_tesoreria.repository';
import { IngresoTesoreriaService } from '../../services/pagos/ingreso_tesoreria.service';
import { IngresoTesoreriaController } from '../../controllers/pagos/ingreso_tesoreria.controller';
import { FlujoCajaRepository } from '../../repositories/pagos/flujo_caja.repository';
import { FlujoCajaService } from '../../services/pagos/flujo_caja.service';
import { FlujoCajaController } from '../../controllers/pagos/flujo_caja.controller';
import { PagoMaterialRepository } from '../../repositories/pagos/pago_material.repository';
import { PagoMaterialService } from '../../services/pagos/pago_material.service';
import { PagoMaterialController } from '../../controllers/pagos/pago_material.controller';
import { CombustibleRepository } from '../../repositories/pagos/combustible.repository';
import { CombustibleService } from '../../services/pagos/combustible.service';
import { CombustibleController } from '../../controllers/pagos/combustible.controller';
import { PagoCombustibleRepository } from '../../repositories/pagos/pago_combustible.repository';
import { PagoCombustibleService } from '../../services/pagos/pago_combustible.service';
import { PagoCombustibleController } from '../../controllers/pagos/pago_combustible.controller';
import { PagoFleteRepository } from '../../repositories/pagos/pago_flete.repository';
import { PagoFleteService } from '../../services/pagos/pago_flete.service';
import { PagoFleteController } from '../../controllers/pagos/pago_flete.controller';
import { PagoAguaRepository } from '../../repositories/pagos/pago_agua.repository';
import { PagoAguaService } from '../../services/pagos/pago_agua.service';
import { PagoAguaController } from '../../controllers/pagos/pago_agua.controller';
import { AnticipoRepository } from '../../repositories/pagos/anticipo.repository';
import { AnticipoService } from '../../services/pagos/anticipo.service';
import { AnticipoController } from '../../controllers/pagos/anticipo.controller';
import { PagoMulaRepository } from '../../repositories/pagos/pago_mula.repository';
import { PagoMulaService } from '../../services/pagos/pago_mula.service';
import { PagoMulaController } from '../../controllers/pagos/pago_mula.controller';

export class PagosFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private tipoAlquilerRepository?: TipoAlquilerRepository;
    private alquilerRepository?: AlquilerRepository;
    private pagoAlquilerRepository?: PagoAlquilerRepository;
    private contratoAlquilerRepository?: ContratoAlquilerRepository;
    private gastoDirectoRepository?: GastoDirectoRepository;
    private categoriaCxCRepository?: CategoriaCxCRepository;
    private cuentasPorCobrarRepository?: MySQLCuentasPorCobrarRepo;
    private cuentasPorPagarRepository?: MySQLCuentasPorPagarRepo;
    private categoriaCxPRepository?: CategoriaCxPRepository;
    private tipoGastoOperativoRepository?: TipoGastoOperativoRepository;
    private categoriaProveedorRepository?: CategoriaProveedorRepository;
    private proveedorRepository?: ProveedorRepository;
    private deudaRepository?: DeudaRepository;
    private vEstadoAlquileresRepository?: VEstadoAlquileresRepository;
    private vEstadoCombustibleRepository?: VEstadoCombustibleRepository;
    private vEstadoMulasRepository?: VEstadoMulasRepository;
    private vSaldosAFavorRepository?: VSaldosAFavorRepository;

    private tipoAlquilerService?: TipoAlquilerService;
    private alquilerService?: AlquilerService;
    private pagoAlquilerService?: PagoAlquilerService;
    private contratoAlquilerService?: ContratoAlquilerService;
    private gastoDirectoService?: GastoDirectoService;
    private categoriaCxCService?: CategoriaCxCService;
    private cuentasPorCobrarService?: CuentasPorCobrarService;
    private cuentasPorPagarService?: CuentasPorPagarService;
    private categoriaCxPService?: CategoriaCxPService;
    private tipoGastoOperativoService?: TipoGastoOperativoService;
    private categoriaProveedorService?: CategoriaProveedorService;
    private proveedorService?: ProveedorService;

    private tipoAlquilerController?: TipoAlquilerController;
    private alquilerController?: AlquilerController;
    private pagoAlquilerController?: PagoAlquilerController;
    private contratoAlquilerController?: ContratoAlquilerController;
    private gastoDirectoController?: GastoDirectoController;
    private categoriaCxCController?: CategoriaCxCController;
    private cuentasPorCobrarController?: CuentasPorCobrarController;
    private cuentasPorPagarController?: CuentasPorPagarController;
    private categoriaCxPController?: CategoriaCxPController;
    private tipoGastoOperativoController?: TipoGastoOperativoController;
    private categoriaProveedorController?: CategoriaProveedorController;
    private proveedorController?: ProveedorController;
    private deudaService?: DeudaService;
    private deudaController?: DeudaController;
    private prestamoFinancieroRepository?: PrestamoFinancieroRepository;
    private prestamoFinancieroService?: PrestamoFinancieroService;
    private prestamoFinancieroController?: PrestamoFinancieroController;
    private ingresoTesoreriaRepository?: IngresoTesoreriaRepository;
    private ingresoTesoreriaService?: IngresoTesoreriaService;
    private ingresoTesoreriaController?: IngresoTesoreriaController;
    private flujoCajaRepository?: FlujoCajaRepository;
    private flujoCajaService?: FlujoCajaService;
    private flujoCajaController?: FlujoCajaController;
    private pagoMaterialRepository?: PagoMaterialRepository;
    private pagoMaterialService?: PagoMaterialService;
    private pagoMaterialController?: PagoMaterialController;
    private combustibleRepository?: CombustibleRepository;
    private combustibleService?: CombustibleService;
    private combustibleController?: CombustibleController;
    private pagoCombustibleRepository?: PagoCombustibleRepository;
    private pagoCombustibleService?: PagoCombustibleService;
    private pagoCombustibleController?: PagoCombustibleController;
    private pagoFleteRepository?: PagoFleteRepository;
    private pagoFleteService?: PagoFleteService;
    private pagoFleteController?: PagoFleteController;
    private pagoAguaRepository?: PagoAguaRepository;
    private pagoAguaService?: PagoAguaService;
    private pagoAguaController?: PagoAguaController;
    private anticipoRepository?: AnticipoRepository;
    private anticipoService?: AnticipoService;
    private anticipoController?: AnticipoController;
    private pagoMulaRepository?: PagoMulaRepository;
    private pagoMulaService?: PagoMulaService;
    private pagoMulaController?: PagoMulaController;

    public getTipoAlquilerRepository(): TipoAlquilerRepository {
        if (!this.tipoAlquilerRepository) this.tipoAlquilerRepository = new TipoAlquilerRepository(this.db);
        return this.tipoAlquilerRepository;
    }

    public getAlquilerRepository(): AlquilerRepository {
        if (!this.alquilerRepository) this.alquilerRepository = new AlquilerRepository(this.db);
        return this.alquilerRepository;
    }

    public getPagoAlquilerRepository(): PagoAlquilerRepository {
        if (!this.pagoAlquilerRepository) this.pagoAlquilerRepository = new PagoAlquilerRepository(this.db);
        return this.pagoAlquilerRepository;
    }

    public getContratoAlquilerRepository(): ContratoAlquilerRepository {
        if (!this.contratoAlquilerRepository) this.contratoAlquilerRepository = new ContratoAlquilerRepository(this.db);
        return this.contratoAlquilerRepository;
    }

    public getGastoDirectoRepository(): GastoDirectoRepository {
        if (!this.gastoDirectoRepository) this.gastoDirectoRepository = new GastoDirectoRepository(this.db);
        return this.gastoDirectoRepository;
    }

    public getCategoriaCxCRepository(): CategoriaCxCRepository {
        if (!this.categoriaCxCRepository) this.categoriaCxCRepository = new CategoriaCxCRepository(this.db);
        return this.categoriaCxCRepository;
    }

    public getCuentasPorPagarRepository(): MySQLCuentasPorPagarRepo {
        if (!this.cuentasPorPagarRepository) this.cuentasPorPagarRepository = new MySQLCuentasPorPagarRepo(this.db);
        return this.cuentasPorPagarRepository;
    }

    public getCuentasPorCobrarRepository(): MySQLCuentasPorCobrarRepo {
        if (!this.cuentasPorCobrarRepository) this.cuentasPorCobrarRepository = new MySQLCuentasPorCobrarRepo(this.db);
        return this.cuentasPorCobrarRepository;
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

    public getProveedorRepository(): ProveedorRepository {
        if (!this.proveedorRepository) this.proveedorRepository = new ProveedorRepository(this.db);
        return this.proveedorRepository;
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

    public getAlquilerService(): AlquilerService {
        if (!this.alquilerService) this.alquilerService = new AlquilerService(this.getAlquilerRepository());
        return this.alquilerService;
    }

    public getPagoAlquilerService(): PagoAlquilerService {
        if (!this.pagoAlquilerService) this.pagoAlquilerService = new PagoAlquilerService(this.getPagoAlquilerRepository(), this.db);
        return this.pagoAlquilerService;
    }

    public getContratoAlquilerService(): ContratoAlquilerService {
        if (!this.contratoAlquilerService) this.contratoAlquilerService = new ContratoAlquilerService(this.getContratoAlquilerRepository(), this.db);
        return this.contratoAlquilerService;
    }

    public getGastoDirectoService(): GastoDirectoService {
        if (!this.gastoDirectoService) this.gastoDirectoService = new GastoDirectoService(this.getGastoDirectoRepository());
        return this.gastoDirectoService;
    }

    public getCategoriaCxCService(): CategoriaCxCService {
        if (!this.categoriaCxCService) this.categoriaCxCService = new CategoriaCxCService(this.getCategoriaCxCRepository());
        return this.categoriaCxCService;
    }

    public getCuentasPorPagarService(): CuentasPorPagarService {
        if (!this.cuentasPorPagarService) this.cuentasPorPagarService = new CuentasPorPagarService(this.getCuentasPorPagarRepository());
        return this.cuentasPorPagarService;
    }

    public getCuentasPorCobrarService(): CuentasPorCobrarService {
        if (!this.cuentasPorCobrarService) this.cuentasPorCobrarService = new CuentasPorCobrarService(this.getCuentasPorCobrarRepository(), this.db);
        return this.cuentasPorCobrarService;
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

    public getProveedorService(): ProveedorService {
        if (!this.proveedorService) this.proveedorService = new ProveedorService(this.getProveedorRepository());
        return this.proveedorService;
    }

    public getTipoAlquilerController(): TipoAlquilerController {
        if (!this.tipoAlquilerController) this.tipoAlquilerController = new TipoAlquilerController(this.getTipoAlquilerService());
        return this.tipoAlquilerController;
    }

    public getAlquilerController(): AlquilerController {
        if (!this.alquilerController) this.alquilerController = new AlquilerController(this.getAlquilerService());
        return this.alquilerController;
    }

    public getPagoAlquilerController(): PagoAlquilerController {
        if (!this.pagoAlquilerController) this.pagoAlquilerController = new PagoAlquilerController(this.getPagoAlquilerService());
        return this.pagoAlquilerController;
    }

    public getContratoAlquilerController(): ContratoAlquilerController {
        if (!this.contratoAlquilerController) this.contratoAlquilerController = new ContratoAlquilerController(this.getContratoAlquilerService());
        return this.contratoAlquilerController;
    }

    public getGastoDirectoController(): GastoDirectoController {
        if (!this.gastoDirectoController) this.gastoDirectoController = new GastoDirectoController(this.getGastoDirectoService());
        return this.gastoDirectoController;
    }

    public getCategoriaCxCController(): CategoriaCxCController {
        if (!this.categoriaCxCController) this.categoriaCxCController = new CategoriaCxCController(this.getCategoriaCxCService());
        return this.categoriaCxCController;
    }

    public getCuentasPorPagarController(): CuentasPorPagarController {
        if (!this.cuentasPorPagarController) this.cuentasPorPagarController = new CuentasPorPagarController(this.getCuentasPorPagarService());
        return this.cuentasPorPagarController;
    }

    public getCuentasPorCobrarController(): CuentasPorCobrarController {
        if (!this.cuentasPorCobrarController) this.cuentasPorCobrarController = new CuentasPorCobrarController(this.getCuentasPorCobrarService());
        return this.cuentasPorCobrarController;
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

    public getProveedorController(): ProveedorController {
        if (!this.proveedorController) this.proveedorController = new ProveedorController(this.getProveedorService());
        return this.proveedorController;
    }

    public getDeudaService(): DeudaService {
        if (!this.deudaService) this.deudaService = new DeudaService(
            this.getDeudaRepository(),
            this.getVEstadoAlquileresRepository(),
            this.getVEstadoCombustibleRepository(),
            this.getVEstadoMulasRepository(),
            this.getVSaldosAFavorRepository()
        );
        return this.deudaService;
    }

    public getDeudaController(): DeudaController {
        if (!this.deudaController) this.deudaController = new DeudaController(this.getDeudaService());
        return this.deudaController;
    }


    public getPrestamoFinancieroRepository(): PrestamoFinancieroRepository {
        if (!this.prestamoFinancieroRepository) this.prestamoFinancieroRepository = new PrestamoFinancieroRepository(this.db);
        return this.prestamoFinancieroRepository;
    }

    public getPrestamoFinancieroService(): PrestamoFinancieroService {
        if (!this.prestamoFinancieroService) this.prestamoFinancieroService = new PrestamoFinancieroService(this.getPrestamoFinancieroRepository(), this.db);
        return this.prestamoFinancieroService;
    }

    public getPrestamoFinancieroController(): PrestamoFinancieroController {
        if (!this.prestamoFinancieroController) this.prestamoFinancieroController = new PrestamoFinancieroController(this.getPrestamoFinancieroService());
        return this.prestamoFinancieroController;
    }

    // ===== Tesorería: ingresos + flujo de caja =====
    public getIngresoTesoreriaRepository(): IngresoTesoreriaRepository {
        if (!this.ingresoTesoreriaRepository) this.ingresoTesoreriaRepository = new IngresoTesoreriaRepository(this.db);
        return this.ingresoTesoreriaRepository;
    }

    public getIngresoTesoreriaService(): IngresoTesoreriaService {
        if (!this.ingresoTesoreriaService) this.ingresoTesoreriaService = new IngresoTesoreriaService(this.getIngresoTesoreriaRepository());
        return this.ingresoTesoreriaService;
    }

    public getIngresoTesoreriaController(): IngresoTesoreriaController {
        if (!this.ingresoTesoreriaController) this.ingresoTesoreriaController = new IngresoTesoreriaController(this.getIngresoTesoreriaService());
        return this.ingresoTesoreriaController;
    }

    public getFlujoCajaRepository(): FlujoCajaRepository {
        if (!this.flujoCajaRepository) this.flujoCajaRepository = new FlujoCajaRepository(this.db);
        return this.flujoCajaRepository;
    }

    public getFlujoCajaService(): FlujoCajaService {
        if (!this.flujoCajaService) this.flujoCajaService = new FlujoCajaService(this.getFlujoCajaRepository());
        return this.flujoCajaService;
    }

    public getFlujoCajaController(): FlujoCajaController {
        if (!this.flujoCajaController) this.flujoCajaController = new FlujoCajaController(this.getFlujoCajaService());
        return this.flujoCajaController;
    }

    // ===== Pago agrupado de material (CxP + abonos) =====
    public getPagoMaterialRepository(): PagoMaterialRepository {
        if (!this.pagoMaterialRepository) this.pagoMaterialRepository = new PagoMaterialRepository(this.db);
        return this.pagoMaterialRepository;
    }

    public getPagoMaterialService(): PagoMaterialService {
        if (!this.pagoMaterialService) this.pagoMaterialService = new PagoMaterialService(this.getPagoMaterialRepository(), this.db);
        return this.pagoMaterialService;
    }

    public getPagoMaterialController(): PagoMaterialController {
        if (!this.pagoMaterialController) this.pagoMaterialController = new PagoMaterialController(this.getPagoMaterialService());
        return this.pagoMaterialController;
    }

    // ===== Combustible / ACPM =====
    public getCombustibleRepository(): CombustibleRepository {
        if (!this.combustibleRepository) this.combustibleRepository = new CombustibleRepository(this.db);
        return this.combustibleRepository;
    }

    public getCombustibleService(): CombustibleService {
        if (!this.combustibleService) this.combustibleService = new CombustibleService(this.getCombustibleRepository());
        return this.combustibleService;
    }

    public getCombustibleController(): CombustibleController {
        if (!this.combustibleController) this.combustibleController = new CombustibleController(this.getCombustibleService());
        return this.combustibleController;
    }

    // ===== Pago de combustible a la gasolinera (CxP por mes + abonos en cascada) =====
    public getPagoCombustibleRepository(): PagoCombustibleRepository {
        if (!this.pagoCombustibleRepository) this.pagoCombustibleRepository = new PagoCombustibleRepository(this.db);
        return this.pagoCombustibleRepository;
    }

    public getPagoCombustibleService(): PagoCombustibleService {
        if (!this.pagoCombustibleService) this.pagoCombustibleService = new PagoCombustibleService(
            this.getPagoCombustibleRepository(), this.db
        );
        return this.pagoCombustibleService;
    }

    public getPagoCombustibleController(): PagoCombustibleController {
        if (!this.pagoCombustibleController) this.pagoCombustibleController = new PagoCombustibleController(this.getPagoCombustibleService());
        return this.pagoCombustibleController;
    }

    // ===== Pago de flete al dueño (CxP por mes + abonos en cascada) =====
    public getPagoFleteRepository(): PagoFleteRepository {
        if (!this.pagoFleteRepository) this.pagoFleteRepository = new PagoFleteRepository(this.db);
        return this.pagoFleteRepository;
    }

    public getPagoFleteService(): PagoFleteService {
        if (!this.pagoFleteService) this.pagoFleteService = new PagoFleteService(
            this.getPagoFleteRepository(), this.getCombustibleService(), this.db
        );
        return this.pagoFleteService;
    }

    public getPagoFleteController(): PagoFleteController {
        if (!this.pagoFleteController) this.pagoFleteController = new PagoFleteController(this.getPagoFleteService());
        return this.pagoFleteController;
    }

    // ===== Pago de agua al dueño (CxP por mes + abonos en cascada) =====
    public getPagoAguaRepository(): PagoAguaRepository {
        if (!this.pagoAguaRepository) this.pagoAguaRepository = new PagoAguaRepository(this.db);
        return this.pagoAguaRepository;
    }

    public getPagoAguaService(): PagoAguaService {
        if (!this.pagoAguaService) this.pagoAguaService = new PagoAguaService(this.getPagoAguaRepository(), this.db);
        return this.pagoAguaService;
    }

    public getPagoAguaController(): PagoAguaController {
        if (!this.pagoAguaController) this.pagoAguaController = new PagoAguaController(this.getPagoAguaService());
        return this.pagoAguaController;
    }

    // ===== Anticipos a terceros (minero/dueño de volqueta/proveedor) =====
    public getAnticipoRepository(): AnticipoRepository {
        if (!this.anticipoRepository) this.anticipoRepository = new AnticipoRepository(this.db);
        return this.anticipoRepository;
    }

    public getAnticipoService(): AnticipoService {
        if (!this.anticipoService) this.anticipoService = new AnticipoService(this.getAnticipoRepository(), this.db);
        return this.anticipoService;
    }

    public getAnticipoController(): AnticipoController {
        if (!this.anticipoController) this.anticipoController = new AnticipoController(this.getAnticipoService());
        return this.anticipoController;
    }

    // ===== Pago de Mulas (despachos a Barranquilla: CxP simple + control de discrepancia) =====
    public getPagoMulaRepository(): PagoMulaRepository {
        if (!this.pagoMulaRepository) this.pagoMulaRepository = new PagoMulaRepository(this.db);
        return this.pagoMulaRepository;
    }

    public getPagoMulaService(): PagoMulaService {
        if (!this.pagoMulaService) this.pagoMulaService = new PagoMulaService(this.getPagoMulaRepository(), this.db);
        return this.pagoMulaService;
    }

    public getPagoMulaController(): PagoMulaController {
        if (!this.pagoMulaController) this.pagoMulaController = new PagoMulaController(this.getPagoMulaService());
        return this.pagoMulaController;
    }
}
