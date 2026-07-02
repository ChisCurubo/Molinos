import { ITipoAnalisisService } from '../../ports/material/service_port/analisis.service.interface';
import { ITipoAnalisisRepository } from '../../ports/material/repository_port/analisis.repository.interface';
import { TipoAnalisisRepository } from '../../repositories/material/analisis.repository';
import { TipoAnalisisSQL } from '../../models/material/sql/tipo_analisis.sql';

// --- Original: tipo_analisis ---
export class TipoAnalisisService implements ITipoAnalisisService {
    private repository: ITipoAnalisisRepository;

    constructor() {
        this.repository = new TipoAnalisisRepository();
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
import { AnalisisRepository } from '../../repositories/material/analisis.repository';
import { MySQLMaterialPlantaEntradaRepo, PrecioMaterialRepository, TarifaCalculoRepository } from '../../repositories/material/material.repository';

export class AnalisisService implements IAnalisisService {
    private analisisRepo: AnalisisRepository;
    private materialRepo: MySQLMaterialPlantaEntradaRepo;
    private precioRepo: PrecioMaterialRepository;
    private tarifaRepo: TarifaCalculoRepository;

    constructor() {
        this.analisisRepo = new AnalisisRepository();
        this.materialRepo = new MySQLMaterialPlantaEntradaRepo();
        this.precioRepo = new PrecioMaterialRepository();
        this.tarifaRepo = new TarifaCalculoRepository();
    }

    async vincularAnalisisAEntrada(data: CreateAnalisisDTO): Promise<void> {
        const pool = Database.getInstance();
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Insertar el análisis
            await this.analisisRepo.insertar(data, conn);

            // 2. Obtener la entrada
            const queryEntrada = `
                SELECT mpe.peso_llegada_planta, mi.id_minero, mi.id_zona, mn.metodo_calculo
                FROM material_planta_entrada mpe
                JOIN mina mi ON mi.id = mpe.id_mina
                LEFT JOIN minero mn ON mn.id = mi.id_minero
                WHERE mpe.id = ?
            `;
            const [rowsEntrada] = await conn.execute<any[]>(queryEntrada, [data.id_entrada]);
            if (!rowsEntrada.length) throw new Error("Entrada no encontrada");
            const entrada = rowsEntrada[0];

            // 3. Cálculos físicos (Fase 3)
            const gramos_humedad = entrada.peso_llegada_planta * data.porcentaje_humedad;
            const total_material_seco = data.toneladas_secas;
            const tenor = data.au_gr_x_ton_falso;
            const total_gramos = total_material_seco * tenor;

            // 4. Buscar Precio (Fase 4)
            const hoy = new Date().toISOString().split('T')[0];
            const precio = await this.precioRepo.buscarPrecioAplicable(
                entrada.id_minero, entrada.id_zona, entrada.metodo_calculo, tenor, hoy, conn
            );
            
            let id_precio = null, precio_por_gramo = 0, precio_por_tonelada = 0, precio_total = 0;
            if (precio) {
                id_precio = precio.id;
                precio_por_gramo = precio.precio_por_gramo;
                precio_por_tonelada = precio.precio_por_tonelada;
                if (entrada.metodo_calculo === 'por_gramo') {
                    precio_total = total_gramos * precio_por_gramo;
                } else {
                    precio_total = total_material_seco * precio_por_tonelada;
                }
            }

            // 5. Costos y totales (Fase 5)
            const excedente_calculado = total_material_seco * 100000;
            const costo_cargue = 300000;
            const costo_bascula = 0;
            const costo_maquila = 0; // Dependiendo de la lógica extra
            const costo_adicional = 0;
            const tarifaVolqueta = await this.tarifaRepo.obtenerTarifaZonaOCalculo(entrada.id_zona, conn);
            const costo_volqueta = entrada.peso_llegada_planta * tarifaVolqueta;
            
            const total_costos_operativos = costo_cargue + costo_bascula + costo_maquila + costo_adicional + costo_volqueta;
            const total_material = precio_total + total_costos_operativos + excedente_calculado;

            const datosActualizados = {
                porcentaje_humedad: data.porcentaje_humedad,
                gramos_humedad,
                total_material_seco,
                tenor,
                total_gramos,
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

            await this.materialRepo.actualizarFases3a5(data.id_entrada, datosActualizados, conn);

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
}