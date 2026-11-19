import { Pool } from 'mysql2/promise';
import { ProductoRepository } from '../../repositories/inventario_productos/producto.repository';
import { MovimientoRepository } from '../../repositories/inventario_productos/movimiento.repository';
import { ProductoService, MovimientoService, ResumenInventarioService } from '../../services/inventario_productos/inventario_productos.service';
import { ProductoController, MovimientoController, ResumenInventarioController } from '../../controllers/inventario_productos/inventario_productos.controller';

export class InventarioProductosFactory {
    private productoRepository?: ProductoRepository;
    private movimientoRepository?: MovimientoRepository;

    private productoService?: ProductoService;
    private movimientoService?: MovimientoService;
    private resumenService?: ResumenInventarioService;

    private productoController?: ProductoController;
    private movimientoController?: MovimientoController;
    private resumenController?: ResumenInventarioController;

    constructor(private db: Pool) {}

    public getProductoRepository(): ProductoRepository {
        if (!this.productoRepository) this.productoRepository = new ProductoRepository(this.db);
        return this.productoRepository;
    }

    public getMovimientoRepository(): MovimientoRepository {
        if (!this.movimientoRepository) this.movimientoRepository = new MovimientoRepository(this.db);
        return this.movimientoRepository;
    }

    public getProductoService(): ProductoService {
        if (!this.productoService) this.productoService = new ProductoService(this.getProductoRepository());
        return this.productoService;
    }

    public getMovimientoService(): MovimientoService {
        if (!this.movimientoService) this.movimientoService = new MovimientoService(this.getMovimientoRepository(), this.getProductoRepository());
        return this.movimientoService;
    }

    public getResumenService(): ResumenInventarioService {
        if (!this.resumenService) this.resumenService = new ResumenInventarioService(this.getProductoRepository(), this.getMovimientoRepository());
        return this.resumenService;
    }

    public getProductoController(): ProductoController {
        if (!this.productoController) this.productoController = new ProductoController(this.getProductoService());
        return this.productoController;
    }

    public getMovimientoController(): MovimientoController {
        if (!this.movimientoController) this.movimientoController = new MovimientoController(this.getMovimientoService());
        return this.movimientoController;
    }

    public getResumenController(): ResumenInventarioController {
        if (!this.resumenController) this.resumenController = new ResumenInventarioController(this.getResumenService());
        return this.resumenController;
    }
}
