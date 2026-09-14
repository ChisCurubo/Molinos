import { Pool, PoolConnection } from 'mysql2/promise';
import { IConcentradoRepository } from '../../ports/material/concentrado.interface';
import { IConcentradoService } from '../../ports/material/service_port/concentrado.service.interface';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';

export class ConcentradoService implements IConcentradoService {
    private repo: IConcentradoRepository;
    private db: Pool;
    private triggerLogicRepo: TriggerLogicRepository;

    constructor(repo: IConcentradoRepository, db: Pool, triggerLogicRepo: TriggerLogicRepository) {
        this.repo = repo;
        this.db = db;
        this.triggerLogicRepo = triggerLogicRepo;
    }

    // Normaliza un checkbox del front (true/1/"1"/"true") a 1|0 para la BD.
    private toFlag(v: any): number {
        return (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
    }

    // Merma en gramos: número >= 0 (default 0). Lanza si es inválida.
    private mermaValida(v: any): number {
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new Error('La merma debe ser un número >= 0');
        return n;
    }

    // Fecha → 'YYYY-MM-DD' (para consultar la tarifa vigente).
    private fechaStr(v: any): string {
        return (v instanceof Date) ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10);
    }

    // Fecha → 'dd/mm/aa' para mostrar en el front (año a 2 dígitos). null si no hay fecha.
    private ddmmaa(v: any): string | null {
        if (!v) return null;
        let y: number | undefined, m: number | undefined, d: number | undefined;
        if (typeof v === 'string') {
            const mt = v.match(/^(\d{4})-(\d{2})-(\d{2})/); // 'YYYY-MM-DD...' (evita corrimiento por zona horaria)
            if (mt) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
        }
        if (y === undefined) {
            const dt = (v instanceof Date) ? v : new Date(v);
            if (isNaN(dt.getTime())) return null;
            y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
        }
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).slice(-2)}`;
    }

    // Agrega fecha_inicio_fmt / fecha_fin_fmt (dd/mm/aa) a una fila de lote sin perder las crudas.
    private conFechasFmt(lote: any): any {
        if (!lote) return lote;
        return { ...lote, fecha_inicio_fmt: this.ddmmaa(lote.fecha_inicio), fecha_fin_fmt: this.ddmmaa(lote.fecha_fin) };
    }

    // Recalcula y PERSISTE la maquila del lote (material_seco_procesado + precio + total)
    // a partir de los procesos actuales del lote y el material seco procesado hasta el momento.
    // Reutilizado al vincular material (provisional) y al editar el lote.
    private async recalcularMaquilaLote(id: number, lote: any, fechaOverride: any, conn: PoolConnection): Promise<{ total_seco: number, tarifa: number, maquila_total: number }> {
        const total_seco = await this.repo.obtenerTotalSecoProcesado(id, conn);
        const fecha = this.fechaStr(fechaOverride || lote.fecha_fin || lote.fecha_inicio || new Date());
        const tarifa = await this.repo.obtenerTarifaMaquila({
            fecha,
            hizo_molienda: this.toFlag(lote.hizo_molienda),
            hizo_flotacion: this.toFlag(lote.hizo_flotacion),
            hizo_relave: this.toFlag(lote.hizo_relave),
            hizo_filtroprensa: this.toFlag(lote.hizo_filtroprensa)
        }, conn);
        const maquila_total = Math.round(tarifa * total_seco * 100) / 100;
        await this.repo.actualizarLote(id, {
            material_seco_procesado: total_seco,
            precio_maquila_por_ton: tarifa,
            maquila_total
        }, conn);
        return { total_seco, tarifa, maquila_total };
    }

    async iniciarLote(data: any): Promise<number> {
        // Los procesos (Molienda/Flotación/Relave/Filtroprensa) ahora se declaran al crear
        // el lote (checkboxes en el front). Se guardan aquí; la maquila se calcula cuando
        // ya hay material procesado (al editar o al cerrar).
        const payload = {
            ...data,
            hizo_molienda: this.toFlag(data.hizo_molienda),
            hizo_flotacion: this.toFlag(data.hizo_flotacion),
            hizo_relave: this.toFlag(data.hizo_relave),
            hizo_filtroprensa: this.toFlag(data.hizo_filtroprensa)
        };
        return await this.repo.iniciarLote(payload);
    }

    // --- MERMA (endpoints dedicados) -----------------------------------------
    // Merma en gramos de metal que se pierde del lote. Se guarda en material_concentrado
    // y se resta a los gramos de venta al despachar en viaje.

    async obtenerMerma(id: number): Promise<any> {
        const lote = await this.repo.obtenerLotePorId(id);
        if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
        return {
            id: lote.id,
            codigo: lote.codigo,
            merma_au: Number(lote.merma_au) || 0,
            merma_ag: Number(lote.merma_ag) || 0
        };
    }

    async actualizarMerma(id: number, data: any): Promise<any> {
        const lote = await this.repo.obtenerLotePorId(id);
        if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
        const payload: any = {};
        if (data.merma_au !== undefined) payload.merma_au = this.mermaValida(data.merma_au);
        if (data.merma_ag !== undefined) payload.merma_ag = this.mermaValida(data.merma_ag);
        if (Object.keys(payload).length === 0) throw new Error('Envía merma_au y/o merma_ag');
        await this.repo.actualizarLote(id, payload);
        return await this.obtenerMerma(id);
    }

    // --- LECTURA -------------------------------------------------------------

    // Listar lotes (todos los estados) con filtros.
    async listarLotes(filtros: any): Promise<any[]> {
        const lotes = await this.repo.listarLotes(filtros);
        return lotes.map(l => this.conFechasFmt(l));
    }

    // Detalle de un lote + materiales vinculados + análisis del concentrado.
    async obtenerLoteDetalle(id: number): Promise<any> {
        const lote = await this.repo.obtenerLotePorId(id);
        if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
        const [materiales, analisis] = await Promise.all([
            this.repo.obtenerMaterialesDeLote(id),
            this.repo.obtenerAnalisisDeLote(id)
        ]);

        // Precio atribuible a este lote por cada material = precio de la entrada × fracción
        // procesada (un material puede repartirse entre varios lotes). Sumado = total del lote.
        let precio_total_material = 0;
        let total_material_con_costos = 0;
        const materialesEnriquecidos = materiales.map(m => {
            const seco = Number(m.total_material_seco) || 0;
            const aportado = Number(m.toneladas_seco_aportadas) || 0;
            const fraccion = seco > 0 ? aportado / seco : 0;
            const precio_material_lote = Math.round((Number(m.precio_total) || 0) * fraccion * 100) / 100;
            const total_material_lote = Math.round((Number(m.total_material) || 0) * fraccion * 100) / 100;
            precio_total_material += precio_material_lote;
            total_material_con_costos += total_material_lote;
            return {
                ...m,
                fraccion_procesada: Math.round(fraccion * 10000) / 10000,
                precio_material_lote,   // precio del material atribuible a ESTE lote
                total_material_lote     // idem incluyendo costos operativos
            };
        });
        precio_total_material = Math.round(precio_total_material * 100) / 100;
        total_material_con_costos = Math.round(total_material_con_costos * 100) / 100;

        return {
            ...this.conFechasFmt(lote),
            num_materiales: materiales.length,
            materiales: materialesEnriquecidos,
            analisis,
            precio_total_material,        // Σ precio de materiales atribuible al lote
            total_material_con_costos     // Σ incluyendo costos operativos
        };
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
            // 0. Validar el lote y su estado (solo se agrega material a lotes en proceso).
            const lote = await this.repo.obtenerLotePorId(id_lote, conn);
            if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
            if (lote.estado !== 'en_proceso') {
                const e: any = new Error('Solo se puede agregar material a un lote en proceso');
                e.status = 409; throw e;
            }

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

            // 4. Insertar en procesamiento_material + mover inventario/kardex
            //    (réplica en app del trigger 'trg_after_insert_procesamiento_material').
            for (const fila of filas) {
                await this.repo.agregarMaterialAlMolino(fila, conn);
                await this.repo.marcarCrudoEnProceso(fila.id_entrada, id_lote, fila.toneladas_aportadas, conn);
            }

            // 5. Recalcular la maquila provisional del lote con el material acumulado
            //    y devolver el total del lote (no solo lo de esta llamada).
            const maq = await this.recalcularMaquilaLote(id_lote, lote, null, conn);

            await conn.commit();
            return {
                filas,
                total_seco_agregado: filas.reduce((s, f) => s + f.toneladas_seco_aportadas, 0),
                // Acumulado del lote tras agregar este material:
                material_seco_procesado: maq.total_seco,
                precio_maquila_por_ton: maq.tarifa,
                maquila_total: maq.maquila_total
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

            // Réplica en app del trigger 'trg_after_insert_procesamiento_material'
            // (inventario 'en_proceso' + kardex SALIDA_PROCESO). No descuenta toneladas.
            await this.repo.marcarCrudoEnProceso(data.id_entrada, data.id_material_concentrado, data.toneladas_aportadas, conn);

            await conn.commit();
            return id;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    // Editar campos del lote (whitelist). No toca estado ni toneladas del concentrado,
    // pero SÍ recalcula la maquila cuando cambian los procesos aplicados
    // (Molienda/Flotación/Relave/Filtroprensa). Si el lote ya está cerrado (en_canoa),
    // vuelve a repartir la maquila a cada material y a la MPE (costo_maquila).
    async editarLote(id: number, data: any): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const lote = await this.repo.obtenerLotePorId(id, conn);
            if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }

            // Campos editables directos (precio_maquila_por_ton se DERIVA, no se acepta manual).
            const permitidos = ['codigo', 'fecha_inicio', 'comentarios', 'ubicacion_canoa'];
            const flags = ['hizo_molienda', 'hizo_flotacion', 'hizo_relave', 'hizo_filtroprensa'];

            const payload: any = {};
            for (const k of permitidos) if (data[k] !== undefined) payload[k] = data[k];
            for (const k of flags) if (data[k] !== undefined) payload[k] = this.toFlag(data[k]);

            if (Object.keys(payload).length === 0) throw new Error('No hay campos válidos para actualizar');

            // 1. Persistir los cambios directos (incluye los procesos ya normalizados).
            await this.repo.actualizarLote(id, payload, conn);

            // 2. Recalcular la maquila con los procesos EFECTIVOS (lote + cambios) y persistirla.
            const loteEfectivo = { ...lote, ...payload };
            const maq = await this.recalcularMaquilaLote(id, loteEfectivo, payload.fecha_inicio, conn);

            // 3. Si ya está cerrado, re-repartir la maquila a los materiales y propagar a la MPE.
            if (lote.estado === 'en_canoa') {
                const toneladas_seco = Number(lote.toneladas_seco) || 0;
                await this.repo.distribuirMaquilaYConcentrado(id, maq.total_seco, toneladas_seco, maq.maquila_total, conn);
                if (maq.maquila_total > 0) {
                    await this.repo.propagarMaquilaAEntradas(id, conn);
                }
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
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

    // Eliminar un lote en proceso O cerrado (en_canoa, sin despachar): devuelve el stock de
    // los materiales crudos al inventario, revierte el lote de concentrado (inventario+kardex+
    // maquila de la MPE) si estaba cerrado, borra análisis y el lote. NO permitido si ya fue
    // despachado en algún viaje.
    async eliminarLoteTx(idLote: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const lote = await this.repo.obtenerLotePorId(idLote, conn);
            if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
            if (lote.estado !== 'en_proceso' && lote.estado !== 'en_canoa') {
                const e: any = new Error('Solo se puede eliminar un lote en proceso o en canoa (no despachado en viajes)');
                e.status = 409; throw e;
            }
            const enViajes = await this.repo.contarLineasViajeDeLote(idLote, conn);
            if (enViajes > 0) {
                const e: any = new Error('El lote ya está incluido en viajes; no se puede eliminar');
                e.status = 409; throw e;
            }

            const eraCerrado = lote.estado === 'en_canoa';

            // 1. Si estaba cerrado, revertir el concentrado producido: quitar su lote de
            //    inventario + kardex y la maquila propagada a las entradas.
            if (eraCerrado) {
                await this.repo.eliminarInventarioConcentradoDeLote(idLote, conn);
                await this.repo.revertirMaquilaEntradas(idLote, conn);
            }

            // 2. Devolver el material crudo al inventario (lo saca de 'agotado'/'en_proceso'
            //    a 'almacenado' y registra el kardex de reverso) y borrar el procesamiento.
            const procesamientos = await this.repo.obtenerProcesamientos(idLote, conn);
            for (const p of procesamientos) {
                await this.repo.restaurarInventarioDeEntrada(p.id_entrada, Number(p.toneladas_aportadas) || 0, idLote, conn);
                await this.repo.eliminarProcesamiento(p.id, conn);
            }

            // 3. Borrar análisis del lote y el lote.
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

            const { toneladas_humedo, fecha_fin, hizo_molienda, hizo_flotacion, hizo_relave, hizo_filtroprensa, ubicacion_canoa } = data;

            // Humedad OPCIONAL al cerrar: si no se envía, se toma del análisis del concentrado
            // (tipo 2) si ya existe; si no hay análisis todavía, 0.
            let porcentaje_humedad = data.porcentaje_humedad;
            if (porcentaje_humedad === undefined || porcentaje_humedad === null) {
                porcentaje_humedad = (await this.repo.obtenerHumedadAnalisisConcentrado(id, conn)) ?? 0;
            }

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
                destino_referencia: `Lote ${oldRow.codigo}`
            }, conn);

            // 7. Marcar los lotes crudos como agotados (réplica trg #3, parte inventario)
            await this.repo.marcarCrudosAgotados(id, conn);

            // 8. Distribuir maquila_proporcional en procesamiento_material
            await this.repo.distribuirMaquilaYConcentrado(id, total_seco, toneladas_seco, maquila_total, conn);

            // 9. Propagar la maquila a las entradas (mpe.costo_maquila) (réplica trg #3)
            if (maquila_total > 0) {
                await this.repo.propagarMaquilaAEntradas(id, conn);
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    // Corregir el CONCENTRADO producido de un lote YA CERRADO ("me equivoqué, generé esto").
    // Solo si está en_canoa (cerrado y aún sin despachar). Ajusta el concentrado en
    // material_concentrado + su lote de Inventario_Lotes + kardex de ajuste, y re-reparte
    // el concentrado_proporcional a cada material. La maquila NO cambia (depende del material
    // crudo procesado, no del concentrado de salida).
    async corregirConcentradoTx(id: number, data: any): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const lote = await this.repo.obtenerLotePorId(id, conn);
            if (!lote) { const e: any = new Error('Lote no encontrado'); e.status = 404; throw e; }
            if (lote.estado !== 'en_canoa') {
                const e: any = new Error('Solo se puede corregir el concentrado de un lote en canoa (cerrado y sin despachar)');
                e.status = 409; throw e;
            }

            const toneladas_humedo = Number(data.toneladas_humedo);
            if (!(toneladas_humedo > 0)) throw new Error('toneladas_humedo debe ser mayor que 0');
            const porcentaje_humedad = data.porcentaje_humedad !== undefined
                ? Number(data.porcentaje_humedad) : (Number(lote.porcentaje_humedad) || 0);
            const toneladas_seco = Math.round(toneladas_humedo * (1 - porcentaje_humedad) * 10000) / 10000;

            // 1. Corregir el lote de concentrado.
            await this.repo.actualizarLote(id, {
                toneladas_humedo,
                porcentaje_humedad,
                toneladas_seco,
                toneladas_disponibles: toneladas_humedo, // en_canoa = nada despachado aún
                ...(data.ubicacion_canoa !== undefined ? { ubicacion_canoa: data.ubicacion_canoa } : {})
            }, conn);

            // 2. Corregir el lote de Inventario_Lotes del concentrado + kardex de ajuste.
            const inv = await this.repo.obtenerInventarioLoteConcentrado(id, conn);
            if (inv) {
                const anterior = Number(inv.toneladas_disponibles) || 0;
                await this.repo.actualizarInventarioLoteConcentrado(inv.id, {
                    toneladas_humedo,
                    porcentaje_humedad,
                    condicion_material: porcentaje_humedad > 0 ? 'Humedo' : 'Seco'
                }, conn);
                const diff = Math.round((toneladas_humedo - anterior) * 10000) / 10000;
                await this.repo.insertarKardexMovimiento({
                    id_lote: inv.id,
                    tipo_movimiento: 'AJUSTE_MERMA',
                    toneladas_movidas: Math.abs(diff),
                    destino_referencia: `Corrección concentrado lote ${lote.codigo} (${anterior}t -> ${toneladas_humedo}t)`
                }, conn);
            }

            // 3. Re-repartir concentrado_proporcional (cambió toneladas_seco). La maquila NO cambia.
            const total_seco = await this.repo.obtenerTotalSecoProcesado(id, conn);
            const maquila_total = Number(lote.maquila_total) || 0;
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
