import { ITipoAnalisisService } from '../../ports/material/service_port/analisis.service.interface';
import { ITipoAnalisisRepository } from '../../ports/material/repository_port/analisis.repository.interface';
import { TipoAnalisisRepository } from '../../repositories/material/analisis.repository';
import { TipoAnalisisSQL } from '../../models/material/sql/tipo_analisis.sql';

// --- Original: tipo_analisis ---
export class TipoAnalisisService implements ITipoAnalisisService {
    private repository: ITipoAnalisisRepository;

    constructor(repository: ITipoAnalisisRepository) {
        this.repository = repository;
    }

    async create(data: any): Promise<TipoAnalisisSQL> {
        const id = await this.repository.create(data);
        const entity = await this.repository.getById(id);
        return entity!;
    }

    async getById(id: number): Promise<TipoAnalisisSQL | null> {
        return this.repository.getById(id);
    }

    async update(id: number, data: any): Promise<TipoAnalisisSQL | null> {
        await this.repository.update(id, data);
        return this.repository.getById(id);
    }

    async delete(id: number): Promise<boolean> {
        return this.repository.delete(id);
    }

    async list(): Promise<TipoAnalisisSQL[]> {
        return this.repository.list();
    }
}

import { IAnalisisService } from '../../ports/material/service_port/analisis.service.interface';
import { CreateAnalisisDTO } from '../../models/material/sql/analisis.sql';
import Database from '../../config/database.config';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';
import { IAnalisisRepository } from '../../ports/material/repository_port/analisis.repository.interface';
import { IPrecioMaterialRepository, ITarifaCalculoRepository } from '../../ports/material/repository_port/material.repository.interface';
import { IMaterialEntradaRepository } from '../../ports/material/repository_port/material.repository.interface';
import { IConcentradoRepository } from '../../ports/material/concentrado.interface';

export class AnalisisService implements IAnalisisService {
    private analisisRepo: IAnalisisRepository;
    private materialRepo: IMaterialEntradaRepository;
    private precioRepo: IPrecioMaterialRepository;
    private tarifaRepo: ITarifaCalculoRepository;
    private triggerLogicRepo: TriggerLogicRepository;
    private concentradoRepo: IConcentradoRepository;

    constructor(
        analisisRepo: IAnalisisRepository,
        materialRepo: IMaterialEntradaRepository,
        precioRepo: IPrecioMaterialRepository,
        tarifaRepo: ITarifaCalculoRepository,
        triggerLogicRepo: TriggerLogicRepository,
        concentradoRepo: IConcentradoRepository
    ) {
        this.analisisRepo = analisisRepo;
        this.materialRepo = materialRepo;
        this.precioRepo = precioRepo;
        this.tarifaRepo = tarifaRepo;
        this.triggerLogicRepo = triggerLogicRepo;
        this.concentradoRepo = concentradoRepo;
    }

    async vincularAnalisisAEntrada(data: CreateAnalisisDTO): Promise<void> {
        const pool = Database.getInstance();
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const porcentaje_decimal = data.porcentaje_humedad > 1 ? data.porcentaje_humedad / 100 : data.porcentaje_humedad;
            data.porcentaje_humedad = porcentaje_decimal;

            if (data.id_tipo_analisis === 1) {
                // TIPO 1: CRUDO
                if (!data.id_entrada) throw new Error("id_entrada es requerido para análisis tipo 1");
                const entrada = await this.materialRepo.obtenerPorId(data.id_entrada, conn);
                if (!entrada) throw new Error("Entrada no encontrada");

                data.id_tipo_material = entrada.id_tipo_material;

                const toneladas_brutas = data.toneladas;
                const toneladas_humedas = toneladas_brutas * porcentaje_decimal;
                const toneladas_secas = toneladas_brutas - toneladas_humedas;
                
                data.toneladas_humedas = toneladas_humedas;
                data.toneladas_secas = toneladas_secas;
                data.au_gr_x_ton = data.au_concentrado * toneladas_secas;
                data.ag_gr_x_ton = data.ag_concentrado * toneladas_secas;

                await this.analisisRepo.insertar(data, conn);
                
                const gramos_humedad = toneladas_humedas;
                const total_material_seco = toneladas_secas;
                const tenor = data.au_falso || 0;
                const total_gramos_pago = total_material_seco * tenor;

                const hoy = new Date().toISOString().split('T')[0];
                const precio = await this.precioRepo.buscarPrecioAplicable(
                    entrada.minero_id, entrada.zona_id, entrada.metodo_calculo as string, tenor, hoy, conn
                );
                
                let id_precio = null, precio_por_gramo = 0, precio_por_tonelada = 0, precio_total = 0;
                if (precio) {
                    id_precio = precio.id;
                    precio_por_gramo = precio.precio_por_gramo;
                    precio_por_tonelada = precio.precio_por_tonelada;
                    if (entrada.metodo_calculo === 'por_gramo') {
                        precio_total = total_gramos_pago * precio_por_gramo;
                    } else {
                        precio_total = total_material_seco * precio_por_tonelada;
                    }
                }

                const excedente_calculado = total_material_seco * 100000;
                const costo_cargue = 300000;
                const costo_bascula = 0;
                const costo_maquila = 0;
                const costo_adicional = 0;
                const tarifaVolqueta = await this.tarifaRepo.obtenerTarifaZonaOCalculo(entrada.zona_id, conn);
                const costo_volqueta = entrada.peso_llegada_planta * tarifaVolqueta;
                
                const total_costos_operativos = costo_cargue + costo_bascula + costo_maquila + costo_adicional + costo_volqueta;
                const total_material = precio_total + total_costos_operativos + excedente_calculado;

                const datosActualizados = {
                    porcentaje_humedad: data.porcentaje_humedad,
                    gramos_humedad,
                    total_material_seco,
                    tenor,
                    total_gramos: total_gramos_pago,
                    id_precio,
                    precio_por_gramo,
                    precio_por_tonelada,
                    precio_total,
                    excedente_calculado,
                    costo_cargue,
                    costo_bascula,
                    costo_maquila,
                    costo_adicional,
                    costo_volqueta,
                    total_costos_operativos,
                    total_material
                };

                await this.materialRepo.actualizarCompleto(data.id_entrada, datosActualizados as any, conn);
                await this.materialRepo.actualizarEstado(data.id_entrada, 'en_proceso' as any, conn);

            } else if (data.id_tipo_analisis === 2) {
                // TIPO 2: CONCENTRADO
                if (!data.id_material_concentrado) throw new Error("id_material_concentrado es requerido para análisis tipo 2");
                const lote = await this.concentradoRepo.obtenerLotePorId(data.id_material_concentrado, conn);
                if (!lote) throw new Error("Lote de concentrado no encontrado");

                const toneladas_brutas = lote.toneladas_humedo || data.toneladas || 0;
                const toneladas_humedas = toneladas_brutas * porcentaje_decimal;
                const toneladas_secas = toneladas_brutas - toneladas_humedas;
                
                data.toneladas_humedas = toneladas_humedas;
                data.toneladas_secas = toneladas_secas;
                data.au_gr_x_ton = data.au_concentrado * toneladas_secas;
                data.ag_gr_x_ton = data.ag_concentrado * toneladas_secas;

                await this.analisisRepo.insertar(data, conn);
            } else {
                throw new Error("Tipo de análisis no soportado");
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async obtenerCabezaPorEntrada(id_entrada: number): Promise<any | null> {
        return await this.analisisRepo.obtenerCabezaPorEntrada(id_entrada);
    }

    async obtenerTodosPorEntrada(id_entrada: number): Promise<any[]> {
        return await this.analisisRepo.obtenerTodosPorEntrada(id_entrada);
    }

    async actualizarAnalisis(identificador: string | number, data: any): Promise<void> {
        const pool = Database.getInstance();
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const analisisExistente = await this.analisisRepo.obtenerPorIdentificador(identificador, conn);
            if (!analisisExistente) throw new Error('Análisis no encontrado.');

            let porcentaje_decimal = analisisExistente.porcentaje_humedad;
            if (data.porcentaje_humedad !== undefined) {
                porcentaje_decimal = data.porcentaje_humedad > 1 ? data.porcentaje_humedad / 100 : data.porcentaje_humedad;
                data.porcentaje_humedad = porcentaje_decimal;
            }

            if (analisisExistente.id_tipo_analisis === 1) {
                let idEntradaActual = analisisExistente.id_entrada!;

                if (data.id_entrada !== undefined && data.id_entrada !== idEntradaActual) {
                    await this.materialRepo.resetearCalculos(idEntradaActual, conn);
                    idEntradaActual = data.id_entrada;
                }

                const entrada = await this.materialRepo.obtenerPorId(idEntradaActual, conn);
                if (!entrada) throw new Error("Entrada no encontrada");

                const baseToneladasHumedas = analisisExistente.toneladas_humedas || analisisExistente.ton;
                const toneladas_brutas = data.toneladas !== undefined ? data.toneladas : analisisExistente.ton;
                const toneladas_humedas = toneladas_brutas * porcentaje_decimal;
                const toneladas_secas = toneladas_brutas - toneladas_humedas;
                
                data.toneladas_humedas = toneladas_humedas;
                data.toneladas_secas = toneladas_secas;

                const au_concentrado = data.au_concentrado !== undefined ? data.au_concentrado : analisisExistente.au_concentrado;
                data.au_gr_x_ton = au_concentrado * toneladas_secas;

                const ag_concentrado = data.ag_concentrado !== undefined ? data.ag_concentrado : analisisExistente.ag_concentrado;
                data.ag_gr_x_ton = ag_concentrado * toneladas_secas;

                const success = await this.analisisRepo.actualizar(identificador, data, conn);
                if (!success) {
                    throw new Error('No se pudo actualizar el análisis.');
                }

                const gramos_humedad = toneladas_humedas;
                const total_material_seco = toneladas_secas;
                const tenor = data.au_falso !== undefined ? data.au_falso : analisisExistente.tenor_falso;
                const total_gramos_pago = total_material_seco * tenor;

                const hoy = new Date().toISOString().split('T')[0];
                const precio = await this.precioRepo.buscarPrecioAplicable(
                    entrada.minero_id, entrada.zona_id, entrada.metodo_calculo as string, tenor, hoy, conn
                );
                
                let id_precio = null, precio_por_gramo = 0, precio_por_tonelada = 0, precio_total = 0;
                if (precio) {
                    id_precio = precio.id;
                    precio_por_gramo = precio.precio_por_gramo;
                    precio_por_tonelada = precio.precio_por_tonelada;
                    if (entrada.metodo_calculo === 'por_gramo') {
                        precio_total = total_gramos_pago * precio_por_gramo;
                    } else {
                        precio_total = total_material_seco * precio_por_tonelada;
                    }
                }

                const excedente_calculado = total_material_seco * 100000;
                const costo_cargue = 300000;
                const costo_bascula = 0;
                const costo_maquila = 0;
                const costo_adicional = 0;
                const tarifaVolqueta = await this.tarifaRepo.obtenerTarifaZonaOCalculo(entrada.zona_id, conn);
                const costo_volqueta = entrada.peso_llegada_planta * tarifaVolqueta;
                
                const total_costos_operativos = costo_cargue + costo_bascula + costo_maquila + costo_adicional + costo_volqueta;
                const total_material = precio_total + total_costos_operativos + excedente_calculado;

                const datosActualizados = {
                    porcentaje_humedad: porcentaje_decimal,
                    gramos_humedad,
                    total_material_seco,
                    tenor,
                    total_gramos: total_gramos_pago,
                    id_precio,
                    precio_por_gramo,
                    precio_por_tonelada,
                    precio_total,
                    excedente_calculado,
                    costo_cargue,
                    costo_bascula,
                    costo_maquila,
                    costo_adicional,
                    costo_volqueta,
                    total_costos_operativos,
                    total_material
                };

                await this.materialRepo.actualizarCompleto(entrada.id, datosActualizados as any, conn);
                await this.materialRepo.actualizarEstado(idEntradaActual, 'en_proceso' as any, conn);
            } else if (analisisExistente.id_tipo_analisis === 2) {
                // TIPO 2: CONCENTRADO
                let idLoteActual = analisisExistente.id_material_concentrado!;

                if (data.id_material_concentrado !== undefined && data.id_material_concentrado !== idLoteActual) {
                    idLoteActual = data.id_material_concentrado;
                }

                const lote = await this.concentradoRepo.obtenerLotePorId(idLoteActual, conn);
                if (!lote) throw new Error("Lote de concentrado no encontrado");

                const toneladas_brutas = lote.toneladas_humedo || data.toneladas || 0;
                const toneladas_humedas = toneladas_brutas * porcentaje_decimal;
                const toneladas_secas = toneladas_brutas - toneladas_humedas;
                
                data.toneladas_humedas = toneladas_humedas;
                data.toneladas_secas = toneladas_secas;

                const au_concentrado = data.au_concentrado !== undefined ? data.au_concentrado : analisisExistente.au_concentrado;
                data.au_gr_x_ton = au_concentrado * toneladas_secas;

                const ag_concentrado = data.ag_concentrado !== undefined ? data.ag_concentrado : analisisExistente.ag_concentrado;
                data.ag_gr_x_ton = ag_concentrado * toneladas_secas;

                const success = await this.analisisRepo.actualizar(identificador, data, conn);
                if (!success) {
                    throw new Error('No se pudo actualizar el análisis.');
                }
            } else {
                throw new Error("Tipo de análisis no soportado");
            }
            
            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_after_update_mpe' de la BD.
            // await this.triggerLogicRepo.afterUpdateMPE(conn, entrada, newMpeRow);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async agregarValorAnalisis(identificador: string | number, valor_analisis: number): Promise<void> {
        const success = await this.analisisRepo.actualizarValor(identificador, valor_analisis);
        if (!success) {
            throw new Error('No se pudo actualizar el valor del análisis o no se encontró.');
        }
    }
}