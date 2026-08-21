import { Pool } from 'mysql2/promise';
import { IConcentradoRepository } from '../../ports/material/concentrado.interface';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';

export class ConcentradoService {
    private repo: IConcentradoRepository;
    private db: Pool;
    private triggerLogicRepo: TriggerLogicRepository;

    constructor(repo: IConcentradoRepository, db: Pool, triggerLogicRepo: TriggerLogicRepository) {
        this.repo = repo;
        this.db = db;
        this.triggerLogicRepo = triggerLogicRepo;
    }

    async iniciarLote(data: any): Promise<number> {
        return await this.repo.iniciarLote(data);
    }

    // --- LECTURA -------------------------------------------------------------

    // Listar lotes (todos los estados) con filtros.
    async listarLotes(filtros: any): Promise<any[]> {
        return await this.repo.listarLotes(filtros);
    }

    // Detalle de un lote + materiales vinculados + análisis del concentrado.
    async obtenerLoteDetalle(id: number): Promise<any> {
        const lote = await this.repo.obtenerLotePorId(id);
        if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
        const [materiales, analisis] = await Promise.all([
            this.repo.obtenerMaterialesDeLote(id),
            this.repo.obtenerAnalisisDeLote(id)
        ]);
        return { ...lote, num_materiales: materiales.length, materiales, analisis };
    }

    // Lista plana de materiales procesados, con sus análisis embebidos.
    async listarProcesamiento(filtros: any): Promise<any[]> {
        const filas = await this.repo.listarProcesamiento(filtros);
        if (filas.length === 0) return [];
        const ids = filas.map(f => Number(f.id_entrada));
        const analisis = await this.repo.obtenerAnalisisPorEntradas(ids);
        const porEntrada = new Map<number, any[]>();
        for (const a of analisis) {
            const tipo = a.id_tipo_analisis === 1 ? 'cabeza'
                       : a.id_tipo_analisis === 2 ? 'concentrado' : null;
            const item = {
                id: a.id, tipo, numero_analisis: a.numero_analisis,
                toneladas_secas: a.toneladas_secas, au_gr_x_ton: a.au_gr_x_ton,
                ag_gr_x_ton: a.ag_gr_x_ton, au_concentrado: a.au_concentrado
            };
            const key = Number(a.id_entrada);
            if (!porEntrada.has(key)) porEntrada.set(key, []);
            porEntrada.get(key)!.push(item);
        }
        return filas.map(f => ({ ...f, analisis: porEntrada.get(Number(f.id_entrada)) || [] }));
    }

    // KPIs: conteo por estado + toneladas disponibles totales.
    async resumenProcesamiento(): Promise<any> {
        const rows = await this.repo.resumenLotesPorEstado();
        const out: any = {
            en_proceso: 0, en_canoa: 0, parcialmente_enviado: 0, enviado_completo: 0,
            toneladas_disponibles_total: 0
        };
        let total = 0;
        for (const r of rows) {
            if (r.estado in out) out[r.estado] = Number(r.n) || 0;
            total += Number(r.disponibles) || 0;
        }
        out.toneladas_disponibles_total = Math.round(total * 10000) / 10000;
        return out;
    }

    async procesarLote(id_lote: number, id_entradas: number[], toneladas_procesadas_seco: number): Promise<any> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            // 1. Obtener datos reales de cada entrada
            const entradas = await this.repo.obtenerEntradasParaProcesamiento(id_entradas, conn);
            
            if (entradas.length === 0) {
                throw new Error("No se encontraron entradas");
            }

            // 2. Calcular cuánto tiene disponible cada entrada
            const disponible_total_seco = entradas.reduce(
                (sum, e) => sum + (parseFloat(e.total_material_seco) - parseFloat(e.ya_procesado_seco)), 0
            );

            if (toneladas_procesadas_seco > disponible_total_seco) {
                throw new Error(`Solo hay ${disponible_total_seco}t disponibles, se solicitaron ${toneladas_procesadas_seco}t`);
            }

            // 3. Distribuir proporcionalmente
            const proporcion = toneladas_procesadas_seco / disponible_total_seco;

            let seco_acumulado = 0;
            const filas = entradas.map((entrada, i) => {
                const disponible_seco = parseFloat(entrada.total_material_seco) - parseFloat(entrada.ya_procesado_seco);
                const disponible_humedo = parseFloat(entrada.peso_llegada_planta) * (disponible_seco / parseFloat(entrada.total_material_seco));
                const porcentaje_humedad = parseFloat(entrada.porcentaje_humedad);

                let seco_aportado, humedo_aportado;

                if (i === entradas.length - 1) {
                    seco_aportado = Math.round((toneladas_procesadas_seco - seco_acumulado) * 10000) / 10000;
                    humedo_aportado = Math.round(seco_aportado / (1 - porcentaje_humedad) * 10000) / 10000;
                } else {
                    seco_aportado = Math.round(disponible_seco * proporcion * 10000) / 10000;
                    humedo_aportado = Math.round(disponible_humedo * proporcion * 10000) / 10000;
                    seco_acumulado += seco_aportado;
                }

                return {
                    id_material_concentrado: id_lote,
                    id_entrada: entrada.id,
                    toneladas_aportadas: humedo_aportado,
                    toneladas_seco_aportadas: seco_aportado
                };
            });

            // 4. Insertar en procesamiento_material
            for (const fila of filas) {
                await this.repo.agregarMaterialAlMolino(fila, conn);
            }

            await conn.commit();
            return {
                filas,
                total_seco: filas.reduce((s, f) => s + f.toneladas_seco_aportadas, 0)
            };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async agregarMaterialAlMolinoTx(data: any): Promise<number> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const id = await this.repo.agregarMaterialAlMolino(data, conn);
            const newRow = { ...data, id };

            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_after_insert_procesamiento_material' de la BD.
            // await this.triggerLogicRepo.afterInsertProcesamiento(conn, newRow);

            await conn.commit();
            return id;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    // Editar campos básicos del lote (whitelist). No toca estado ni toneladas.
    async editarLote(id: number, data: any): Promise<void> {
        const lote = await this.repo.obtenerLotePorId(id);
        if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }

        const permitidos = ['codigo', 'fecha_inicio', 'comentarios', 'hizo_molienda', 'hizo_flotacion',
            'hizo_relave', 'hizo_filtroprensa', 'ubicacion_canoa', 'precio_maquila_por_ton'];
        const payload: any = {};
        for (const k of permitidos) if (data[k] !== undefined) payload[k] = data[k];
        if (Object.keys(payload).length === 0) throw new Error('No hay campos válidos para actualizar');

        await this.repo.actualizarLote(id, payload);
    }

    // Desvincular un material (entrada) de un lote en proceso; devuelve su stock al inventario.
    async desvincularMaterialTx(idLote: number, idEntrada: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const lote = await this.repo.obtenerLotePorId(idLote, conn);
            if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
            if (lote.estado !== 'en_proceso') {
                const e: any = new Error('Solo se puede desvincular material de un lote en proceso');
                e.status = 409; throw e;
            }
            const proc = await this.repo.obtenerProcesamientoPorLoteYEntrada(idLote, idEntrada, conn);
            if (!proc) { const e: any = new Error('Ese material no está vinculado al lote'); e.status = 404; throw e; }

            await this.repo.restaurarInventarioDeEntrada(idEntrada, Number(proc.toneladas_aportadas) || 0, idLote, conn);
            await this.repo.eliminarProcesamiento(proc.id, conn);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    // Eliminar un lote en proceso: devuelve todo el material, borra sus análisis y el lote.
    async eliminarLoteTx(idLote: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const lote = await this.repo.obtenerLotePorId(idLote, conn);
            if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
            if (lote.estado !== 'en_proceso') {
                const e: any = new Error('Solo se puede eliminar un lote en proceso (aún no cerrado ni despachado)');
                e.status = 409; throw e;
            }
            const enViajes = await this.repo.contarLineasViajeDeLote(idLote, conn);
            if (enViajes > 0) {
                const e: any = new Error('El lote ya está incluido en viajes; no se puede eliminar');
                e.status = 409; throw e;
            }

            const procesamientos = await this.repo.obtenerProcesamientos(idLote, conn);
            for (const p of procesamientos) {
                await this.repo.restaurarInventarioDeEntrada(p.id_entrada, Number(p.toneladas_aportadas) || 0, idLote, conn);
                await this.repo.eliminarProcesamiento(p.id, conn);
            }
            await this.repo.eliminarAnalisisDeLote(idLote, conn);
            await this.repo.eliminarLote(idLote, conn);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async cerrarLoteConcentradoTx(id: number, data: any): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const oldRow = await this.repo.obtenerLotePorId(id, conn);
            if (!oldRow) throw new Error('Lote no encontrado');

            const { toneladas_humedo, porcentaje_humedad, fecha_fin, hizo_molienda, hizo_flotacion, hizo_relave, hizo_filtroprensa, ubicacion_canoa } = data;

            // 1. Calcular seco
            const toneladas_seco = Math.round(toneladas_humedo * (1 - porcentaje_humedad) * 10000) / 10000;

            // 2. Calcular material seco procesado
            const total_seco = await this.repo.obtenerTotalSecoProcesado(id, conn);

            // 3. Obtener tarifa de maquila
            const tarifa = await this.repo.obtenerTarifaMaquila({
                fecha: fecha_fin,
                hizo_molienda: hizo_molienda ? 1 : 0,
                hizo_flotacion: hizo_flotacion ? 1 : 0,
                hizo_relave: hizo_relave ? 1 : 0,
                hizo_filtroprensa: hizo_filtroprensa ? 1 : 0
            }, conn);

            const maquila_total = Math.round(tarifa * total_seco * 100) / 100;

            // 4. Actualizar el lote
            const newRow = { 
                toneladas_humedo, 
                porcentaje_humedad, 
                toneladas_seco,
                toneladas_disponibles: toneladas_humedo, // en HÚMEDAS
                fecha_fin, 
                ubicacion_canoa,
                hizo_molienda, 
                hizo_flotacion, 
                hizo_relave, 
                hizo_filtroprensa,
                material_seco_procesado: total_seco,
                precio_maquila_por_ton: tarifa,
                maquila_total,
                estado: 'en_canoa' 
            };

            await this.repo.actualizarLote(id, newRow, conn);

            // 5. Crear Inventario_Lotes para el concentrado
            const idInventario = await this.repo.crearInventarioConcentrado({
                id_material_concentrado: id,
                porcentaje_humedad,
                toneladas_humedo,
                ubicacion_canoa
            }, conn);

            // 6. Kardex ENTRADA_CONCENTRADO
            await this.repo.insertarKardexMovimiento({
                id_lote: idInventario,
                tipo_movimiento: 'ENTRADA_CONCENTRADO',
                toneladas_movidas: toneladas_humedo,
                destino_referencia: `Lote ${id}`
            }, conn);

            // 7. Distribuir maquila_proporcional en procesamiento_material
            await this.repo.distribuirMaquilaYConcentrado(id, total_seco, toneladas_seco, maquila_total, conn);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}
