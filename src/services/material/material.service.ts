import { Pool } from 'mysql2/promise';
import { MaterialPlantaEntradaSQL, EstadoEntrada, CreateMaterialEntradaDTO } from '../../models/material/sql/material_planta_entrada.sql';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';
import { IMaterialEntradaRepository } from '../../ports/material/repository_port/material.repository.interface';
import { ITarifaCalculoRepository as ITarifaCalculoRepo } from '../../ports/material/repository_port/material.repository.interface';
import { IAnalisisRepository } from '../../ports/material/repository_port/analisis.repository.interface';
import { IVehiculoRepository } from '../../ports/material/repository_port/volqueta.repository.interface';
import { IMinaRepository } from '../../ports/material/repository_port/mina.repository.interface';
import { HttpError } from '../../helpers/http_error';
import { IMaterialEntradaService } from '../../ports/material/service_port/material.service.interface';
import { ITipoMaterialService } from '../../ports/material/service_port/material.service.interface';
import { ITipoMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { TipoMaterialRepository } from '../../repositories/material/material.repository';
import { TipoMaterialSQL } from '../../models/material/sql/tipo_material.sql';
import { IPrecioMaterialService } from '../../ports/material/service_port/material.service.interface';
import { IPrecioMaterialRepository } from '../../ports/material/repository_port/material.repository.interface';
import { PrecioMaterialRepository } from '../../repositories/material/material.repository';
import { PrecioMaterialSQL } from '../../models/material/sql/precio_material.sql';
import { ITarifaCalculoService } from '../../ports/material/service_port/material.service.interface';
import { ITarifaCalculoRepository } from '../../ports/material/repository_port/material.repository.interface';
import { TarifaCalculoRepository } from '../../repositories/material/material.repository';
import { TarifaCalculoSQL } from '../../models/material/sql/tarifa_calculo.sql';
import { IProveedorService } from '../../ports/material/service_port/material.service.interface';
import { IProveedorRepository } from '../../ports/material/repository_port/material.repository.interface';
import { ProveedorRepository } from '../../repositories/material/material.repository';
import { ProveedorSQL } from '../../models/pagos/sql/proveedor.sql';

// --- Original: material_planta_entrada ---
export class MaterialPlantaEntradaService implements IMaterialEntradaService {
    private repo: IMaterialEntradaRepository;
    private db: Pool;
    private triggerLogicRepo: TriggerLogicRepository;
    private vehiculoRepo: IVehiculoRepository;
    private minaRepo: IMinaRepository;
    private tarifaRepo: ITarifaCalculoRepo;
    private analisisRepo: IAnalisisRepository;

    constructor(
        repo: IMaterialEntradaRepository,
        db: Pool,
        triggerLogicRepo: TriggerLogicRepository,
        vehiculoRepo: IVehiculoRepository,
        minaRepo: IMinaRepository,
        tarifaRepo: ITarifaCalculoRepo,
        analisisRepo: IAnalisisRepository
    ) {
        this.repo = repo;
        this.db = db;
        this.triggerLogicRepo = triggerLogicRepo;
        this.vehiculoRepo = vehiculoRepo;
        this.minaRepo = minaRepo;
        this.tarifaRepo = tarifaRepo;
        this.analisisRepo = analisisRepo;
    }

    async registrarLlegada(data: CreateMaterialEntradaDTO): Promise<number> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            // Si no viene id_vehiculo pero sí un sub-objeto nueva_volqueta, se crea el
            // vehículo primero (misma transacción) y se usa su id como id_vehiculo.
            if (!data.id_vehiculo && data.nueva_volqueta) {
                const nv = data.nueva_volqueta;
                if (!nv.placa) throw new HttpError(400, 'nueva_volqueta.placa es obligatoria');
                const idVehiculo = await this.vehiculoRepo.create({
                    id_dueno_volqueta: nv.id_dueno ?? null,
                    placa: nv.placa,
                    tipo_vehiculo: nv.tipo_vehiculo ?? null,
                    conductor: nv.conductor ?? null,
                    conductor_cc: nv.conductor_cc ?? null,
                    capacidad_ton: nv.capacidad_ton ?? null,
                    activo: 1
                }, conn);
                data.id_vehiculo = idVehiculo;
            }

            const id = await this.repo.registrarLlegada(data, conn);
            const newRow = await this.repo.obtenerPorId(id, conn);

            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_after_insert_mpe' de la BD.
            // (el trigger calcula costo_volqueta = peso × tarifa de zona). Hoy lo hace la BD.
            // await this.triggerLogicRepo.afterInsertMPE(conn, newRow);

            await conn.commit();
            return id;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async obtenerEntrada(id: number): Promise<any> {
        const entrada = await this.repo.obtenerPorId(id);
        if (!entrada) throw new HttpError(404, 'Entrada de material no encontrada');

        // Análisis vinculados, con campos calculados que espera la vista de detalle.
        const analisisRaw = await this.analisisRepo.obtenerTodosPorEntrada(id);
        const analisis = analisisRaw.map((a: any) => ({
            ...a,
            ton_secas: a.toneladas_secas,
            au_gr_t_real: a.tenor_real
        }));

        // Bloque "detalle" mapeado sobre columnas reales de la BD.
        // NOTA: no existe columna acpm en material_planta_entrada (solo en Agua_Planta),
        // por eso acpm_adelantado se expone como 0.
        const detalle = {
            peso_humedo: entrada.peso_llegada_planta,
            humedad_pct: entrada.porcentaje_humedad,
            ton_secas: entrada.total_material_seco,
            tenor_au: entrada.tenor,
            flete: entrada.costo_volqueta,
            acpm_adelantado: 0,
            gastos_operativos: entrada.total_costos_operativos,
            valor_material: entrada.precio_total,
            estado_pago: entrada.estado_pago_flete
        };

        return { ...entrada, analisis, detalle };
    }

    async estadisticas(): Promise<any> {
        return this.repo.estadisticas();
    }

    async actualizarEntrada(id: number, data: CreateMaterialEntradaDTO): Promise<any> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const entrada = await this.repo.obtenerPorId(id, conn);
            if (!entrada) throw new HttpError(404, 'Entrada no encontrada');

            await this.repo.actualizarBase(id, data, conn);

            // Recalcular flete (costo_volqueta) si cambió el peso o la mina (zona).
            const idMina = data.id_mina ?? entrada.mina_id;
            const zonaId = await this.minaRepo.obtenerZonaDeMina(idMina, conn);
            const tarifa = await this.tarifaRepo.obtenerTarifaZonaOCalculo(zonaId, conn);
            const peso = data.peso_llegada_planta ?? entrada.peso_llegada_planta;
            const costo_volqueta = Number(peso) * Number(tarifa);

            // No se tocan tenor/humedad/precio (los define el flujo de análisis).
            const costo_cargue = Number(entrada.costo_cargue || 0);
            const costo_bascula = Number(entrada.costo_bascula || 0);
            const costo_maquila = Number(entrada.costo_maquila || 0);
            const costo_adicional = Number(entrada.costo_adicional || 0);
            const excedente_calculado = Number(entrada.excedente_calculado || 0);
            const total_costos_operativos = costo_cargue + costo_bascula + costo_maquila + costo_adicional + costo_volqueta;
            const total_material = Number(entrada.precio_total || 0) + total_costos_operativos + excedente_calculado;

            await this.repo.actualizarCostos(id, {
                excedente_calculado,
                costo_cargue,
                costo_bascula,
                costo_maquila,
                costo_adicional,
                costo_volqueta,
                total_costos_operativos,
                total_material
            }, conn);

            await conn.commit();
            return await this.repo.obtenerPorId(id);
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async eliminarEntrada(id: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const entrada = await this.repo.obtenerPorId(id, conn);
            if (!entrada) throw new HttpError(404, 'Entrada no encontrada');

            // Ya despachada o pagada: no se borra, se cancela.
            if (entrada.estado === EstadoEntrada.INCLUIDA_VIAJE || entrada.estado === EstadoEntrada.PAGADA) {
                throw new HttpError(409, `No se puede eliminar: la entrada está en estado '${entrada.estado}'. Usa Cancelar.`, 'ENTRADA_NO_ELIMINABLE');
            }

            // Con análisis registrado: no se borra, se cancela (conserva trazabilidad).
            const nAnalisis = await this.repo.contarAnalisis(id, conn);
            if (nAnalisis > 0) {
                throw new HttpError(409, 'No se puede eliminar: la entrada tiene análisis asociados. Usa Cancelar.', 'ENTRADA_CON_ANALISIS');
            }

            // Si algún lote ya tuvo salidas (proceso/viaje), tampoco se borra.
            const nSalidas = await this.repo.contarSalidasInventario(id, conn);
            if (nSalidas > 0) {
                throw new HttpError(409, 'No se puede eliminar: el material ya tuvo movimientos de salida. Usa Cancelar.', 'ENTRADA_CON_SALIDAS');
            }

            // Caso "me equivoqué": borra el inventario que creó el trigger y luego la entrada.
            await this.repo.eliminarInventarioDeEntrada(id, conn);
            await this.repo.eliminar(id, conn);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async listarEntradas(fechaDesde: string, fechaHasta: string, estado: string, limit: number, offset: number): Promise<any[]> {
        return await this.repo.listar(fechaDesde, fechaHasta, estado, limit, offset);
    }

    async listarPendientesLaboratorio(): Promise<any[]> {
        return await this.repo.listarPendientesAnalisis();
    }

    async vincularAnalisis(analisisData: any): Promise<void> {
        throw new Error("vincularAnalisis was moved to AnalisisService.vincularAnalisisAEntrada");
    }

    async listarPorMinero(idMinero: number): Promise<any[]> {
        return await this.repo.listarPorMinero(idMinero);
    }

    async listarPorMina(idMina: number): Promise<any[]> {
        return await this.repo.listarPorMina(idMina);
    }

    async listarPorVehiculo(idVehiculo: number): Promise<any[]> {
        return await this.repo.listarPorVehiculo(idVehiculo);
    }

    async listarPorDueno(idDueno: number): Promise<any[]> {
        return await this.repo.listarPorDueno(idDueno);
    }

    async listarPorFecha(fecha: string): Promise<any[]> {
        return await this.repo.listarPorFecha(fecha);
    }

    async actualizarEstado(id: number, estado: string): Promise<void> {
        return await this.repo.actualizarEstado(id, estado as EstadoEntrada);
    }

    async cancelar(id: number, motivo: string): Promise<void> {
        return await this.repo.cancelar(id, motivo);
    }
}

// --- Original: tipo_material ---
export class TipoMaterialService implements ITipoMaterialService {
    private repository: ITipoMaterialRepository;

    constructor(repository: ITipoMaterialRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<TipoMaterialSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TipoMaterialSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TipoMaterialSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TipoMaterialSQL[]> {
        return this.repository.list();
    }
}

// --- Original: precio_material ---
export class PrecioMaterialService implements IPrecioMaterialService {
    private repository: IPrecioMaterialRepository;

    constructor(repository: IPrecioMaterialRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<PrecioMaterialSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<PrecioMaterialSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<PrecioMaterialSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<PrecioMaterialSQL[]> {
        return this.repository.list();
    }

    async buscarPrecio(idMinero: number | null, idZona: number | null, metodo: string, tenorFalso: number, fechaEntrada: string | Date, conn?: any): Promise<any | null> {
        return this.repository.buscarPrecioAplicable(idMinero, idZona, metodo, tenorFalso, fechaEntrada as string, conn);
    }

    async buscarTarifaZona(idZona: number | null, conn?: any): Promise<number> {
        throw new Error("buscarTarifaZona is handled by TarifaCalculoService");
    }

    async insertarLote(data: any): Promise<void> {
        const { id_minero, id_zona, metodo, fecha_inicio, fecha_fin, intervalos } = data;
        if (!intervalos || !Array.isArray(intervalos) || intervalos.length === 0) {
            throw new Error("El arreglo de intervalos es inválido o está vacío");
        }

        const metodoFinal = metodo || 'por_gramo';
        const precios: Omit<PrecioMaterialSQL, 'id'>[] = intervalos.map((int: any) => ({
            id_minero: id_minero || null,
            id_zona: id_zona || null,
            metodo: metodoFinal,
            precio_por_gramo: int.precio_por_gramo || 0,
            precio_por_tonelada: int.precio_por_tonelada || 0,
            intervalo_tenor_min: int.min,
            intervalo_tenor_max: int.max,
            fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
            fecha_fin: (fecha_fin ? new Date(fecha_fin) : null) as any,
            activo: true,
            created_at: new Date()
        }));

        // Versionado: desactiva los precios vigentes del mismo alcance (minero / zona / general)
        // e inserta el nuevo lote como activo, todo en una transacción.
        await this.repository.reemplazarLoteVigente(id_minero || null, id_zona || null, metodoFinal, precios);
    }

    async reemplazarIntervalo(id: number, data: any): Promise<number> {
        return this.repository.reemplazarIntervalo(id, data);
    }

    async listarPrecios(filtros: { id_minero?: number | null; id_zona?: number | null; alcance?: string; activo?: boolean } = {}): Promise<any[]> {
        return this.repository.listar(filtros);
    }
}

// --- Original: tarifa_calculo ---
export class TarifaCalculoService implements ITarifaCalculoService {
    private repository: ITarifaCalculoRepository;

    constructor(repository: ITarifaCalculoRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<TarifaCalculoSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TarifaCalculoSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TarifaCalculoSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TarifaCalculoSQL[]> {
        return this.repository.list();
    }
}

// --- Original: proveedor ---
export class ProveedorService implements IProveedorService {
    private repository: IProveedorRepository;

    constructor(repository: IProveedorRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<ProveedorSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<ProveedorSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<ProveedorSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<ProveedorSQL[]> {
        return this.repository.list();
    }
}