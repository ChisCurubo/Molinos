import { Pool } from 'mysql2/promise';
import { TipoMaterialRepository, PrecioMaterialRepository, TarifaCalculoRepository, ProveedorRepository as MaterialProveedorRepository } from '../../repositories/material/material.repository';
import { MaterialEntradaRepository } from '../../repositories/material/material.repository';
import { MinaRepository } from '../../repositories/material/mina.repository';
import { MineroRepository, ZonaRepository, TarifaZonaRepository } from '../../repositories/material/mina.repository';
import { DuenoVolquetaRepository } from '../../repositories/material/volqueta.repository';
import { AguaPlantaRepository } from '../../repositories/material/agua.repository';
import { AnalisisRepository, TipoAnalisisRepository } from '../../repositories/material/analisis.repository';
import { VehiculoRepository } from '../../repositories/material/vehiculo.repository';
import { VEstadoPagoMaterialRepository, VEstadoPagoFleteRepository, VExcedenteEmpresaRepository, VExcedentePorVehiculoRepository, VAnalisisCompletoRepository, VEstadoAguaRepository } from '../../repositories/material/views/vistas.material.repository';
import { MinaService, MineroService, ZonaService, TarifaZonaService } from '../../services/material/mina.service';
import { DuenoVolquetaService, VehiculoService } from '../../services/material/volqueta.service';
import { AguaPlantaService } from '../../services/material/agua.service';
import { AnalisisService, TipoAnalisisService } from '../../services/material/analisis.service';
import { 
    MaterialPlantaEntradaService, TipoMaterialService, PrecioMaterialService, 
    TarifaCalculoService, ProveedorService as MaterialProveedorService 
} from '../../services/material/material.service';
import { MaterialEntradaController, TipoMaterialController, PrecioMaterialController, TarifaCalculoController, ProveedorController as MaterialProveedorController } from '../../controllers/material/material.controller';
import { MinaController } from '../../controllers/material/mina.controller';
import { DuenoVolquetaController } from '../../controllers/material/volqueta.controller';
import { AguaPlantaController } from '../../controllers/material/agua.controller';
import { AnalisisController } from '../../controllers/material/analisis.controller';
import { VehiculoController } from '../../controllers/material/vehiculo.controller';
import { VistaMaterialController } from '../../controllers/material/vistas.material.controller';
import { TriggerLogicRepositoryImpl } from '../../repositories/db_triggers/trigger_logic.repository';
import { ConcentradoRepository } from '../../repositories/material/concentrado.repository';
import { ViajesRepository } from '../../repositories/material/viajes.repository';
import { ConcentradoService } from '../../services/material/concentrado.service';
import { ViajesService } from '../../services/material/viajes.service';
import { ConcentradoController } from '../../controllers/material/concentrado.controller';
import { ViajesController } from '../../controllers/material/viajes.controller';
import { InventarioRepository } from '../../repositories/material/inventario.repository';
import { InventarioService } from '../../services/material/inventario.service';
import { InventarioController } from '../../controllers/material/inventario.controller';

export class MaterialFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private triggerLogicRepo?: TriggerLogicRepositoryImpl;
    private materialEntradaRepo?: MaterialEntradaRepository;
    private tipoMaterialRepo?: TipoMaterialRepository;
    private precioMaterialRepo?: PrecioMaterialRepository;
    private tarifaCalculoRepo?: TarifaCalculoRepository;
    private materialProveedorRepo?: MaterialProveedorRepository;
    private minaRepo?: MinaRepository;
    private mineroRepo?: MineroRepository;
    private zonaRepo?: ZonaRepository;
    private tarifaZonaRepo?: TarifaZonaRepository;
    private duenoVolquetaRepo?: DuenoVolquetaRepository;
    private aguaPlantaRepo?: AguaPlantaRepository;
    private analisisRepo?: AnalisisRepository;
    private tipoAnalisisRepo?: TipoAnalisisRepository;
    private vehiculoRepo?: VehiculoRepository;
    private vistaMaterialController?: VistaMaterialController;
    private vEstadoPagoMaterialRepo?: VEstadoPagoMaterialRepository;
    private vEstadoPagoFleteRepo?: VEstadoPagoFleteRepository;
    private vExcedenteEmpresaRepo?: VExcedenteEmpresaRepository;
    private vExcedentePorVehiculoRepo?: VExcedentePorVehiculoRepository;
    private vAnalisisCompletoRepo?: VAnalisisCompletoRepository;
    private vEstadoAguaRepo?: VEstadoAguaRepository;
    private concentradoRepo?: ConcentradoRepository;
    private viajesRepo?: ViajesRepository;
    private inventarioRepo?: InventarioRepository;

    private materialPlantaEntradaService?: MaterialPlantaEntradaService;
    private tipoMaterialService?: TipoMaterialService;
    private precioMaterialService?: PrecioMaterialService;
    private tarifaCalculoService?: TarifaCalculoService;
    private materialProveedorService?: MaterialProveedorService;
    private minaService?: MinaService;
    private mineroService?: MineroService;
    private zonaService?: ZonaService;
    private tarifaZonaService?: TarifaZonaService;
    private duenoVolquetaService?: DuenoVolquetaService;
    private vehiculoService?: VehiculoService;
    private aguaPlantaService?: AguaPlantaService;
    private analisisService?: AnalisisService;
    private tipoAnalisisService?: TipoAnalisisService;
    private concentradoService?: ConcentradoService;
    private viajesService?: ViajesService;
    private inventarioService?: InventarioService;

    private materialEntradaController?: MaterialEntradaController;
    private tipoMaterialController?: TipoMaterialController;
    private precioMaterialController?: PrecioMaterialController;
    private tarifaCalculoController?: TarifaCalculoController;
    private materialProveedorController?: MaterialProveedorController;
    private minaController?: MinaController;
    private duenoVolquetaController?: DuenoVolquetaController;
    private aguaPlantaController?: AguaPlantaController;
    private analisisController?: AnalisisController;
    private vehiculoController?: VehiculoController;
    private concentradoController?: ConcentradoController;
    private viajesController?: ViajesController;
    private inventarioController?: InventarioController;

    // Repos
    public getTriggerLogicRepo(): TriggerLogicRepositoryImpl {
        if (!this.triggerLogicRepo) this.triggerLogicRepo = new TriggerLogicRepositoryImpl(this.db);
        return this.triggerLogicRepo;
    }

    public getMaterialEntradaRepo(): MaterialEntradaRepository {
        if (!this.materialEntradaRepo) this.materialEntradaRepo = new MaterialEntradaRepository(this.db);
        return this.materialEntradaRepo;
    }
    public getTipoMaterialRepo(): TipoMaterialRepository {
        if (!this.tipoMaterialRepo) this.tipoMaterialRepo = new TipoMaterialRepository(this.db);
        return this.tipoMaterialRepo;
    }
    public getPrecioMaterialRepo(): PrecioMaterialRepository {
        if (!this.precioMaterialRepo) this.precioMaterialRepo = new PrecioMaterialRepository(this.db);
        return this.precioMaterialRepo;
    }
    public getTarifaCalculoRepo(): TarifaCalculoRepository {
        if (!this.tarifaCalculoRepo) this.tarifaCalculoRepo = new TarifaCalculoRepository(this.db);
        return this.tarifaCalculoRepo;
    }
    public getMaterialProveedorRepo(): MaterialProveedorRepository {
        if (!this.materialProveedorRepo) this.materialProveedorRepo = new MaterialProveedorRepository(this.db);
        return this.materialProveedorRepo;
    }
    public getMinaRepo(): MinaRepository {
        if (!this.minaRepo) this.minaRepo = new MinaRepository(this.db);
        return this.minaRepo;
    }
    public getMineroRepo(): MineroRepository {
        if (!this.mineroRepo) this.mineroRepo = new MineroRepository(this.db);
        return this.mineroRepo;
    }
    public getZonaRepo(): ZonaRepository {
        if (!this.zonaRepo) this.zonaRepo = new ZonaRepository(this.db);
        return this.zonaRepo;
    }
    public getTarifaZonaRepo(): TarifaZonaRepository {
        if (!this.tarifaZonaRepo) this.tarifaZonaRepo = new TarifaZonaRepository(this.db);
        return this.tarifaZonaRepo;
    }
    public getDuenoVolquetaRepo(): DuenoVolquetaRepository {
        if (!this.duenoVolquetaRepo) this.duenoVolquetaRepo = new DuenoVolquetaRepository(this.db);
        return this.duenoVolquetaRepo;
    }
    public getAguaPlantaRepo(): AguaPlantaRepository {
        if (!this.aguaPlantaRepo) this.aguaPlantaRepo = new AguaPlantaRepository(this.db);
        return this.aguaPlantaRepo;
    }
    public getAnalisisRepo(): AnalisisRepository {
        if (!this.analisisRepo) this.analisisRepo = new AnalisisRepository(this.db);
        return this.analisisRepo;
    }
    public getTipoAnalisisRepo(): TipoAnalisisRepository {
        if (!this.tipoAnalisisRepo) this.tipoAnalisisRepo = new TipoAnalisisRepository(this.db);
        return this.tipoAnalisisRepo;
    }
    public getVehiculoRepo(): VehiculoRepository {
        if (!this.vehiculoRepo) this.vehiculoRepo = new VehiculoRepository(this.db);
        return this.vehiculoRepo;
    }

    // View Repos
    public getVEstadoPagoMaterialRepo(): VEstadoPagoMaterialRepository {
        if (!this.vEstadoPagoMaterialRepo) this.vEstadoPagoMaterialRepo = new VEstadoPagoMaterialRepository(this.db);
        return this.vEstadoPagoMaterialRepo;
    }
    public getVEstadoPagoFleteRepo(): VEstadoPagoFleteRepository {
        if (!this.vEstadoPagoFleteRepo) this.vEstadoPagoFleteRepo = new VEstadoPagoFleteRepository(this.db);
        return this.vEstadoPagoFleteRepo;
    }
    public getVExcedenteEmpresaRepo(): VExcedenteEmpresaRepository {
        if (!this.vExcedenteEmpresaRepo) this.vExcedenteEmpresaRepo = new VExcedenteEmpresaRepository(this.db);
        return this.vExcedenteEmpresaRepo;
    }
    public getVExcedentePorVehiculoRepo(): VExcedentePorVehiculoRepository {
        if (!this.vExcedentePorVehiculoRepo) this.vExcedentePorVehiculoRepo = new VExcedentePorVehiculoRepository(this.db);
        return this.vExcedentePorVehiculoRepo;
    }
    public getVAnalisisCompletoRepo(): VAnalisisCompletoRepository {
        if (!this.vAnalisisCompletoRepo) this.vAnalisisCompletoRepo = new VAnalisisCompletoRepository(this.db);
        return this.vAnalisisCompletoRepo;
    }
    public getVEstadoAguaRepo(): VEstadoAguaRepository {
        if (!this.vEstadoAguaRepo) this.vEstadoAguaRepo = new VEstadoAguaRepository(this.db);
        return this.vEstadoAguaRepo;
    }
    public getConcentradoRepo(): ConcentradoRepository {
        if (!this.concentradoRepo) this.concentradoRepo = new ConcentradoRepository(this.db);
        return this.concentradoRepo;
    }
    public getViajesRepo(): ViajesRepository {
        if (!this.viajesRepo) this.viajesRepo = new ViajesRepository(this.db);
        return this.viajesRepo;
    }
    public getInventarioRepo(): InventarioRepository {
        if (!this.inventarioRepo) this.inventarioRepo = new InventarioRepository(this.db);
        return this.inventarioRepo;
    }

    // Services
    public getMaterialPlantaEntradaService(): MaterialPlantaEntradaService {
        if (!this.materialPlantaEntradaService) this.materialPlantaEntradaService = new MaterialPlantaEntradaService(
            this.getMaterialEntradaRepo(),
            this.db,
            this.getTriggerLogicRepo(),
            this.getVehiculoRepo(),
            this.getMinaRepo(),
            this.getTarifaCalculoRepo(),
            this.getAnalisisRepo()
        );
        return this.materialPlantaEntradaService;
    }
    public getTipoMaterialService(): TipoMaterialService {
        if (!this.tipoMaterialService) this.tipoMaterialService = new TipoMaterialService(this.getTipoMaterialRepo());
        return this.tipoMaterialService;
    }
    public getPrecioMaterialService(): PrecioMaterialService {
        if (!this.precioMaterialService) this.precioMaterialService = new PrecioMaterialService(this.getPrecioMaterialRepo());
        return this.precioMaterialService;
    }
    public getTarifaCalculoService(): TarifaCalculoService {
        if (!this.tarifaCalculoService) this.tarifaCalculoService = new TarifaCalculoService(this.getTarifaCalculoRepo());
        return this.tarifaCalculoService;
    }
    public getMaterialProveedorService(): MaterialProveedorService {
        if (!this.materialProveedorService) this.materialProveedorService = new MaterialProveedorService(this.getMaterialProveedorRepo());
        return this.materialProveedorService;
    }
    public getMinaService(): MinaService {
        if (!this.minaService) this.minaService = new MinaService(this.getMinaRepo());
        return this.minaService;
    }
    public getMineroService(): MineroService {
        if (!this.mineroService) this.mineroService = new MineroService(this.getMineroRepo());
        return this.mineroService;
    }
    public getZonaService(): ZonaService {
        if (!this.zonaService) this.zonaService = new ZonaService(this.getZonaRepo());
        return this.zonaService;
    }
    public getTarifaZonaService(): TarifaZonaService {
        if (!this.tarifaZonaService) this.tarifaZonaService = new TarifaZonaService(this.getTarifaZonaRepo());
        return this.tarifaZonaService;
    }
    public getDuenoVolquetaService(): DuenoVolquetaService {
        if (!this.duenoVolquetaService) this.duenoVolquetaService = new DuenoVolquetaService(this.getDuenoVolquetaRepo());
        return this.duenoVolquetaService;
    }
    public getVehiculoService(): VehiculoService {
        if (!this.vehiculoService) this.vehiculoService = new VehiculoService(this.getVehiculoRepo());
        return this.vehiculoService;
    }
    public getAguaPlantaService(): AguaPlantaService {
        if (!this.aguaPlantaService) this.aguaPlantaService = new AguaPlantaService(this.getAguaPlantaRepo(), this.getVehiculoRepo());
        return this.aguaPlantaService;
    }
    public getAnalisisService(): AnalisisService {
        if (!this.analisisService) this.analisisService = new AnalisisService(
            this.getAnalisisRepo(),
            this.getMaterialEntradaRepo(),
            this.getPrecioMaterialRepo(),
            this.getTarifaCalculoRepo(),
            this.getTriggerLogicRepo(),
            this.getConcentradoRepo()
        );
        return this.analisisService;
    }
    public getTipoAnalisisService(): TipoAnalisisService {
        if (!this.tipoAnalisisService) this.tipoAnalisisService = new TipoAnalisisService(this.getTipoAnalisisRepo());
        return this.tipoAnalisisService;
    }
    public getConcentradoService(): ConcentradoService {
        if (!this.concentradoService) this.concentradoService = new ConcentradoService(
            this.getConcentradoRepo(), 
            this.db, 
            this.getTriggerLogicRepo()
        );
        return this.concentradoService;
    }
    public getViajesService(): ViajesService {
        if (!this.viajesService) this.viajesService = new ViajesService(
            this.getViajesRepo(), 
            this.db, 
            this.getTriggerLogicRepo()
        );
        return this.viajesService;
    }
    public getInventarioService(): InventarioService {
        if (!this.inventarioService) this.inventarioService = new InventarioService(
            this.getInventarioRepo()
        );
        return this.inventarioService;
    }

    // Controllers
    public getMaterialEntradaController(): MaterialEntradaController {
        if (!this.materialEntradaController) this.materialEntradaController = new MaterialEntradaController(
            this.getMaterialPlantaEntradaService()
        );
        return this.materialEntradaController;
    }
    public getTipoMaterialController(): TipoMaterialController {
        if (!this.tipoMaterialController) this.tipoMaterialController = new TipoMaterialController(this.getTipoMaterialService());
        return this.tipoMaterialController;
    }
    public getPrecioMaterialController(): PrecioMaterialController {
        if (!this.precioMaterialController) this.precioMaterialController = new PrecioMaterialController(this.getPrecioMaterialService());
        return this.precioMaterialController;
    }
    public getTarifaCalculoController(): TarifaCalculoController {
        if (!this.tarifaCalculoController) this.tarifaCalculoController = new TarifaCalculoController(this.getTarifaCalculoService());
        return this.tarifaCalculoController;
    }
    public getMaterialProveedorController(): MaterialProveedorController {
        if (!this.materialProveedorController) this.materialProveedorController = new MaterialProveedorController(this.getMaterialProveedorService());
        return this.materialProveedorController;
    }
    public getMinaController(): MinaController {
        if (!this.minaController) this.minaController = new MinaController(
            this.getMinaService(),
            this.getMineroService(),
            this.getZonaService(),
            this.getMinaRepo()
        );
        return this.minaController;
    }
    public getDuenoVolquetaController(): DuenoVolquetaController {
        if (!this.duenoVolquetaController) this.duenoVolquetaController = new DuenoVolquetaController(this.getDuenoVolquetaService());
        return this.duenoVolquetaController;
    }
    public getAguaPlantaController(): AguaPlantaController {
        if (!this.aguaPlantaController) this.aguaPlantaController = new AguaPlantaController(this.getAguaPlantaService());
        return this.aguaPlantaController;
    }
    public getAnalisisController(): AnalisisController {
        if (!this.analisisController) this.analisisController = new AnalisisController(
            this.getAnalisisService(),
            this.getAnalisisRepo()
        );
        return this.analisisController;
    }
    public getVehiculoController(): VehiculoController {
        if (!this.vehiculoController) this.vehiculoController = new VehiculoController(this.getVehiculoService());
        return this.vehiculoController;
    }
    public getVistaMaterialController(): VistaMaterialController {
        if (!this.vistaMaterialController) this.vistaMaterialController = new VistaMaterialController(
            this.getVEstadoPagoMaterialRepo(),
            this.getVEstadoPagoFleteRepo(),
            this.getVExcedenteEmpresaRepo(),
            this.getVExcedentePorVehiculoRepo(),
            this.getVAnalisisCompletoRepo(),
            this.getVEstadoAguaRepo()
        );
        return this.vistaMaterialController;
    }
    public getConcentradoController(): ConcentradoController {
        if (!this.concentradoController) this.concentradoController = new ConcentradoController(
            this.getConcentradoService()
        );
        return this.concentradoController;
    }
    public getViajesController(): ViajesController {
        if (!this.viajesController) this.viajesController = new ViajesController(
            this.getViajesService()
        );
        return this.viajesController;
    }
    public getInventarioController(): InventarioController {
        if (!this.inventarioController) this.inventarioController = new InventarioController(
            this.getInventarioService()
        );
        return this.inventarioController;
    }

}
