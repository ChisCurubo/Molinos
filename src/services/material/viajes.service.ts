import { Pool } from 'mysql2/promise';
import { IViajesRepository } from '../../ports/material/viajes.interface';
import { IViajesService } from '../../ports/material/service_port/viajes.service.interface';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';

export class ViajesService implements IViajesService {
    private repo: IViajesRepository;
    private db: Pool;
    private triggerLogicRepo: TriggerLogicRepository;

    constructor(repo: IViajesRepository, db: Pool, triggerLogicRepo: TriggerLogicRepository) {
        this.repo = repo;
        this.db = db;
        this.triggerLogicRepo = triggerLogicRepo;
    }

    // Crear viaje: lo único requerido es el número de viaje. fecha y comentarios son opcionales.
    async crearCabeceraViaje(data: any): Promise<number> {
        const numero = (data.numero_viaje ?? '').toString().trim();
        if (!numero) throw new Error('El número de viaje es obligatorio');
        return await this.repo.crearCabeceraViaje({ ...data, numero_viaje: numero });
    }

    // Editar la cabecera de un viaje (número, fecha, comentarios).
    async actualizarCabeceraViajeTx(id: number, data: any): Promise<any> {
        const viaje = await this.repo.obtenerViajePorId(id);
        if (!viaje) { const e: any = new Error('Viaje no encontrado'); e.status = 404; throw e; }

        const campos: any = {};
        if (data.numero_viaje !== undefined) {
            const numero = data.numero_viaje.toString().trim();
            if (!numero) throw new Error('El número de viaje no puede quedar vacío');
            campos.numero_viaje = numero;
        }
        if (data.fecha !== undefined) campos.fecha = data.fecha;
        if (data.comentarios !== undefined) campos.comentarios = data.comentarios;

        await this.repo.actualizarCabeceraViaje(id, campos);
        return await this.repo.obtenerViajePorId(id);
    }

    // --- LECTURA -------------------------------------------------------------

    // Listar viajes con filtros; cada viaje trae sus líneas embebidas + agregados (del SQL).
    async listarViajes(filtros: any): Promise<any[]> {
        const viajes = await this.repo.listarViajes(filtros);
        if (viajes.length === 0) return [];
        const ids = viajes.map(v => Number(v.id));
        const lineas = await this.repo.obtenerLineasDeViajes(ids);
        const porViaje = new Map<number, any[]>();
        for (const l of lineas) {
            const key = Number(l.id_viaje);
            if (!porViaje.has(key)) porViaje.set(key, []);
            porViaje.get(key)!.push(l);
        }
        return viajes.map(v => ({ ...v, lineas: porViaje.get(Number(v.id)) || [] }));
    }

    // Detalle de un viaje (reutiliza el listado filtrando por id, ya trae líneas + agregados).
    async obtenerViajeDetalle(id: number): Promise<any> {
        const arr = await this.listarViajes({ id });
        if (arr.length === 0) { const e: any = new Error('Viaje no encontrado'); e.status = 404; throw e; }
        return arr[0];
    }

    // KPIs del período + promedios por viaje.
    async resumenViajes(filtros: any): Promise<any> {
        const r = await this.repo.resumenViajes(filtros);
        const total = Number(r.total_viajes) || 0;
        const auTot = Number(r.au_gramos_total) || 0;
        const agTot = Number(r.ag_gramos_total) || 0;
        return {
            total_viajes: total,
            toneladas_humedo: r.toneladas_humedo,
            toneladas_seco: r.toneladas_seco,
            maquila_total: r.maquila_total,
            valor_material_total: r.valor_material_total,
            total_viaje: r.total_viaje,
            au_gramos_total: r.au_gramos_total,
            ag_gramos_total: r.ag_gramos_total,
            au_promedio_viaje: (total ? auTot / total : 0).toFixed(2),
            ag_promedio_viaje: (total ? agTot / total : 0).toFixed(2)
        };
    }

    // Trazabilidad de un lote en viajes.
    async trazabilidadPorLote(idLote: number): Promise<any[]> {
        return await this.repo.listarLineasPorLote(idLote);
    }

    // Agrupa los aportes por lote y calcula el % de aporte (sobre el seco procesado del lote).
    private agruparAportes(aportes: any[]): Map<number, any[]> {
        const totalSecoPorLote = new Map<number, number>();
        for (const a of aportes) {
            const k = Number(a.id_lote);
            totalSecoPorLote.set(k, (totalSecoPorLote.get(k) || 0) + (Number(a.toneladas_seco_aportadas) || 0));
        }
        const r2 = (n: number) => Math.round(n * 100) / 100;
        const porLote = new Map<number, any[]>();
        for (const a of aportes) {
            const k = Number(a.id_lote);
            const totalSeco = totalSecoPorLote.get(k) || 0;
            const seco = Number(a.toneladas_seco_aportadas) || 0;

            // Fracción de la ENTRADA atribuible a este lote (su costo es del total de la entrada).
            const secoEntrada = Number(a.total_material_seco) || 0;
            const fraccion = secoEntrada > 0 ? seco / secoEntrada : 0;

            // Desglose de costos prorrateado a lo que esta entrada aportó al lote.
            const costo_material = r2((Number(a.precio_total) || 0) * fraccion);       // solo material
            const gastos_operativos = r2((Number(a.total_costos_operativos) || 0) * fraccion);
            const excedente = r2((Number(a.excedente_calculado) || 0) * fraccion);
            const maquila = Number(a.maquila_proporcional) || 0;                        // ya es del lote
            const total_material = r2(costo_material + gastos_operativos);              // material + gastos (SIN excedente)

            const material = {
                id_entrada: a.id_entrada,
                numero_volqueta: a.numero_volqueta,
                mina: a.mina,
                minero: a.minero,
                fecha_llegada: a.fecha_llegada,
                tenor: a.tenor,
                total_material_seco: a.total_material_seco,
                toneladas_aportadas: a.toneladas_aportadas,
                toneladas_seco_aportadas: a.toneladas_seco_aportadas,
                concentrado_proporcional: a.concentrado_proporcional,
                // Desglose de costos (prorrateado por la fracción procesada de la entrada):
                costo_material,          // solo material (precio pagado)
                gastos_operativos,       // cargue/báscula/adicional/volqueta...
                total_material,          // = costo_material + gastos_operativos
                excedente,               // aparte (tenor >= 4)
                maquila,                 // maquila del lote atribuida a este material (para comprobar sumas)
                maquila_proporcional: a.maquila_proporcional,
                porcentaje_aporte: totalSeco > 0 ? Math.round((seco / totalSeco) * 10000) / 100 : 0
            };
            if (!porLote.has(k)) porLote.set(k, []);
            porLote.get(k)!.push(material);
        }
        return porLote;
    }

    // TRAZABILIDAD 1: doy un id de viaje → sus líneas (lotes) y, por cada lote,
    // los materiales de origen con cuánto aportó cada uno.
    async trazabilidadDeViaje(idViaje: number): Promise<any> {
        const viaje = await this.repo.obtenerViajePorId(idViaje);
        if (!viaje) { const e: any = new Error('Viaje no encontrado'); e.status = 404; throw e; }

        const lineas = await this.repo.obtenerLineasConLote(idViaje);
        const idLotes = [...new Set(lineas.map(l => Number(l.id_lote)).filter(Boolean))];
        const aportes = await this.repo.obtenerAportesDeLotes(idLotes);
        const porLote = this.agruparAportes(aportes);

        return {
            id_viaje: viaje.id,
            numero_viaje: viaje.numero_viaje,
            fecha: viaje.fecha,
            comentarios: viaje.comentarios ?? null,
            lineas: lineas.map(l => ({
                id_linea: l.id_linea,
                id_lote: l.id_lote,
                codigo_lote: l.codigo_lote,
                estado_lote: l.estado_lote,
                concentrado_humedo: l.concentrado_humedo,
                concentrado_seco: l.concentrado_seco,
                au_gramos: l.au_gramos,
                ag_gramos: l.ag_gramos,
                materiales: porLote.get(Number(l.id_lote)) || []
            }))
        };
    }

    // TRAZABILIDAD 2: desde una línea de viaje → su lote y los materiales de origen.
    async trazabilidadDeLinea(idLinea: number): Promise<any> {
        const linea = await this.repo.obtenerLineaViajePorId(idLinea);
        if (!linea) { const e: any = new Error('Línea de viaje no encontrada'); e.status = 404; throw e; }

        const [viaje, lote, aportes] = await Promise.all([
            this.repo.obtenerViajePorId(linea.id_viaje),
            this.repo.obtenerLoteConAnalisis(linea.id_material_concentrado),
            this.repo.obtenerAportesDeLotes([Number(linea.id_material_concentrado)])
        ]);
        const materiales = this.agruparAportes(aportes).get(Number(linea.id_material_concentrado)) || [];

        return {
            id_linea: linea.id,
            id_viaje: linea.id_viaje,
            numero_viaje: viaje?.numero_viaje ?? null,
            fecha: viaje?.fecha ?? null,
            id_lote: linea.id_material_concentrado,
            codigo_lote: lote?.codigo ?? linea.concepto ?? null,
            estado_lote: lote?.estado ?? null,
            concentrado_despachado_humedo: linea.total_concentrado_humedo,
            concentrado_despachado_seco: linea.concentrado_seco,
            materiales
        };
    }

    private r4(n: number): number { return Math.round(n * 10000) / 10000; }

    // Resuelve cuánto despachar a partir del input del front (que trabaja en SECO) y devuelve
    // ambas magnitudes. Prioridad: concentrado_seco → total_concentrado_humedo (legacy) → todo.
    // factor = 1 - humedad ; humedo = seco / factor.
    private resolverCantidad(data: any, disponibleHumedo: number, factor: number): { humedo: number, seco: number } {
        if (data.concentrado_seco !== undefined && data.concentrado_seco !== null) {
            const seco = Number(data.concentrado_seco);
            return { seco, humedo: seco / factor };
        }
        if (data.total_concentrado_humedo !== undefined && data.total_concentrado_humedo !== null) {
            const humedo = Number(data.total_concentrado_humedo);
            return { humedo, seco: humedo * factor };
        }
        // Sin cantidad → despachar todo lo disponible del lote.
        return { humedo: disponibleHumedo, seco: disponibleHumedo * factor };
    }

    /**
     * Asigna (despacha) un lote de concentrado a un viaje. TODO el efecto está en la app
     * (migrado de los triggers #4 y #5 — ya no dependemos de la BD):
     *   1. Deriva los datos de la línea del lote + su análisis (seco, tenores, gramos).
     *   2. Calcula la maquila (regla: COMPLETA una sola vez cuando el lote está 'en_canoa';
     *      despachos posteriores cobran 0; los remanentes nunca cobran).
     *   3. Inserta la línea, descuenta el stock del lote (húmedo) + kardex SALIDA_VIAJE,
     *      ajusta el estado del concentrado y, si se agota, marca las MPE como incluida_viaje.
     *   4. Recalcula los totales del viaje.
     * El front envía id_material_concentrado y (opcional) total_concentrado_humedo (cuánto
     * despachar; si se omite se despacha todo lo disponible → despacho parcial soportado).
     */
    async asignarLoteAViajeTx(data: any): Promise<number> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const lote = await this.repo.obtenerLoteConAnalisis(data.id_material_concentrado, conn);
            if (!lote) throw new Error('Lote de concentrado no encontrado');

            const esRemanente = data.es_remanente ? 1 : 0;
            const disponibleHumedo = Number(lote.toneladas_disponibles) || 0;
            const humedad = Number(lote.porcentaje_humedad) || 0;
            const factor = 1 - humedad; // seco = humedo * factor
            if (factor <= 0) throw new Error('La humedad del lote es inválida (>= 100%)');
            const disponibleSeco = disponibleHumedo * factor;

            // El front trabaja en SECO: manda concentrado_seco. Derivamos el húmedo (seco/factor)
            // para descontar el stock, que se guarda en húmedo. Si no se manda nada, despacha todo.
            const { humedo, seco } = this.resolverCantidad(data, disponibleHumedo, factor);

            // Los remanentes son concentrado que ya salió y sobró en otro viaje: no descuentan stock.
            if (!esRemanente) {
                if (disponibleHumedo <= 0) throw new Error('El lote no tiene concentrado disponible para despachar');
                if (seco <= 0) throw new Error('La cantidad de concentrado (seco) a despachar debe ser mayor a 0');
                if (humedo > disponibleHumedo + 1e-6) {
                    throw new Error(`Solo hay ${this.r4(disponibleSeco)} t secas disponibles en el lote; se solicitaron ${this.r4(seco)}`);
                }
            }

            const concentrado_seco = this.r4(seco);
            const total_humedo = this.r4(humedo);
            const peso_humedad = this.r4(total_humedo - concentrado_seco);
            const tenor_au = Number(lote.tenor_au) || 0;
            const tenor_ag = Number(lote.tenor_ag) || 0;

            // Maquila (migrado del trigger #4): completa una sola vez, con el lote en 'en_canoa'.
            let costo_maquila = 0;
            if (!esRemanente && lote.estado === 'en_canoa') {
                costo_maquila = Number(lote.maquila_total) || 0;
            }

            // Tenor de compra promedio del lote (derivado del material de origen).
            const au_promedio_compra = await this.repo.obtenerTenorCompraPromedioLote(data.id_material_concentrado, conn);

            // VALOR TOTAL MATERIAL CON GASTOS: se deriva del total_material del lote (material +
            // gastos, sin excedente), prorrateado por el seco despachado. El front ya no lo manda
            // (pero si lo envía, se respeta como override).
            const totalMaterialLote = await this.repo.obtenerTotalMaterialLote(data.id_material_concentrado, conn);
            const secoLote = Number(lote.toneladas_seco) || 0;
            const valorDerivado = secoLote > 0 ? Math.round(totalMaterialLote * (seco / secoLote) * 100) / 100 : 0;

            const payload = {
                id_viaje: data.id_viaje,
                id_material_concentrado: data.id_material_concentrado,
                total_concentrado_humedo: total_humedo,
                concentrado_seco,
                porcentaje_humedad: humedad,
                peso_humedad,
                es_remanente: esRemanente,
                id_viaje_origen: data.id_viaje_origen || null,
                concepto: data.concepto || lote.codigo,
                costo_maquila,
                au_promedio_compra,
                valor_total_con_gastos: data.valor_total ?? data.valor_total_con_gastos ?? valorDerivado,
                tenor_au_venta: tenor_au,
                total_grs_au_venta: this.r4(concentrado_seco * tenor_au),
                tenor_ag: tenor_ag,
                total_grs_ag_venta: this.r4(concentrado_seco * tenor_ag)
            };

            const id = await this.repo.asignarLoteAViaje(payload, conn);

            // Movimiento de stock (migrado del trigger #5): se descuenta el HÚMEDO derivado.
            if (!esRemanente && total_humedo > 0) {
                const nuevaDisp = await this.repo.descontarStockConcentrado(
                    data.id_material_concentrado, total_humedo, data.id_viaje, conn
                );
                if (nuevaDisp <= 0) {
                    await this.repo.marcarEntradasIncluidasViaje(data.id_material_concentrado, conn);
                }
            }

            await this.repo.recalcularTotalesViaje(data.id_viaje, conn);

            await conn.commit();
            return id;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Actualiza una línea de viaje. Soporta cambiar la CANTIDAD despachada (ej. de 15 → 5 t):
     * calcula el delta y devuelve/descuenta stock en consecuencia, recalcula los derivados de
     * la línea (seco, gramos) y los totales del viaje. La maquila NO cambia (se cobra una vez).
     */
    async actualizarLineaViajeTx(idLinea: number, data: any): Promise<any> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const old = await this.repo.obtenerLineaViajePorId(idLinea, conn);
            if (!old) { const e: any = new Error('Línea de viaje no encontrada'); e.status = 404; throw e; }

            const campos: any = {};
            if (data.concepto !== undefined) campos.concepto = data.concepto;
            if (data.valor_total !== undefined || data.valor_total_con_gastos !== undefined) {
                campos.valor_total_con_gastos = data.valor_total ?? data.valor_total_con_gastos;
            }

            const cambiaCantidad = data.concentrado_seco !== undefined && data.concentrado_seco !== null;
            if (cambiaCantidad && Number(old.es_remanente) === 0 && old.id_material_concentrado) {
                const nuevoSeco = Number(data.concentrado_seco);
                if (nuevoSeco <= 0) throw new Error('La cantidad (seco) debe ser mayor a 0');

                const lote = await this.repo.obtenerEstadoYStockLote(old.id_material_concentrado, conn);
                if (!lote) throw new Error('Lote de concentrado no encontrado');
                const humedad = Number(lote.porcentaje_humedad) || 0;
                const factor = 1 - humedad;
                if (factor <= 0) throw new Error('La humedad del lote es inválida (>= 100%)');

                // El front manda SECO; convertimos a húmedo para mover el stock (que está en húmedo).
                const nuevoHumedo = this.r4(nuevoSeco / factor);
                const viejoHumedo = Number(old.total_concentrado_humedo) || 0;
                const delta = this.r4(nuevoHumedo - viejoHumedo);

                if (delta > 0) {
                    const disp = Number(lote.toneladas_disponibles) || 0;
                    if (delta > disp + 1e-6) {
                        const dispSeco = this.r4(disp * factor);
                        throw new Error(`Solo hay ${dispSeco} t secas adicionales disponibles en el lote`);
                    }
                    const nuevaDisp = await this.repo.descontarStockConcentrado(old.id_material_concentrado, delta, old.id_viaje, conn);
                    if (nuevaDisp <= 0) await this.repo.marcarEntradasIncluidasViaje(old.id_material_concentrado, conn);
                } else if (delta < 0) {
                    await this.repo.devolverStockConcentrado(old.id_material_concentrado, -delta, old.id_viaje, conn);
                    // Vuelve stock al lote → las MPE ya no están "incluida_viaje".
                    await this.repo.revertirEntradasIncluidasViaje(old.id_material_concentrado, conn);
                }

                const seco = this.r4(nuevoSeco);
                const tenorAu = Number(old.tenor_au_venta) || 0;
                const tenorAg = Number(old.tenor_ag) || 0;
                campos.total_concentrado_humedo = nuevoHumedo;
                campos.concentrado_seco = seco;
                campos.porcentaje_humedad = humedad;
                campos.peso_humedad = this.r4(nuevoHumedo - seco);
                campos.total_grs_au_venta = this.r4(seco * tenorAu);
                campos.total_grs_ag_venta = this.r4(seco * tenorAg);

                // Re-deriva el valor material con gastos por el nuevo seco (salvo override del front).
                if (data.valor_total === undefined && data.valor_total_con_gastos === undefined) {
                    const totalMaterialLote = await this.repo.obtenerTotalMaterialLote(old.id_material_concentrado, conn);
                    const secoLote = Number(lote.toneladas_seco) || 0;
                    campos.valor_total_con_gastos = secoLote > 0
                        ? Math.round(totalMaterialLote * (nuevoSeco / secoLote) * 100) / 100
                        : 0;
                }
            }

            await this.repo.actualizarLineaViaje(idLinea, campos, conn);
            await this.repo.recalcularTotalesViaje(old.id_viaje, conn);

            await conn.commit();
            return await this.repo.obtenerLineaViajePorId(idLinea);
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Elimina un viaje completo: por cada línea devuelve el stock al lote (migrado del
     * trigger #7) y luego borra la cabecera.
     */
    async eliminarViajeTx(idViaje: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const viaje = await this.repo.obtenerViajePorId(idViaje, conn);
            if (!viaje) throw new Error('Viaje no encontrado');

            const lineas = await this.repo.obtenerLineasDeViaje(idViaje, conn);
            for (const linea of lineas) {
                const old = await this.repo.obtenerLineaViajePorId(linea.id, conn);
                await this.repo.eliminarLineaViaje(linea.id, conn);
                await this.revertirStockDeLinea(old, conn);
            }

            await this.repo.eliminarViaje(idViaje, conn);
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Elimina una línea de un viaje y devuelve su stock al lote (migrado del trigger #7).
     */
    async eliminarLineaViajeTx(idLinea: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const old = await this.repo.obtenerLineaViajePorId(idLinea, conn);
            if (!old) throw new Error('Línea de viaje no encontrada');

            await this.repo.eliminarLineaViaje(idLinea, conn);
            await this.revertirStockDeLinea(old, conn);
            await this.repo.recalcularTotalesViaje(old.id_viaje, conn);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    // Reversa del stock de una línea borrada (no aplica a remanentes, que no descontaron).
    private async revertirStockDeLinea(old: any, conn: any): Promise<void> {
        const humedo = Number(old.total_concentrado_humedo) || 0;
        if (old.id_material_concentrado && humedo > 0 && Number(old.es_remanente) === 0) {
            await this.repo.devolverStockConcentrado(old.id_material_concentrado, humedo, old.id_viaje, conn);
            // Vuelve stock al lote → las MPE ya no están "incluida_viaje".
            await this.repo.revertirEntradasIncluidasViaje(old.id_material_concentrado, conn);
            await this.repo.marcarLoteEnCanoaSiSinLineas(old.id_material_concentrado, conn);
        }
    }

    // Selector para Mulas (§ ver MULAS_plan.md): viajes armados y sin despachar.
    async listarDisponiblesParaMula(): Promise<any[]> {
        return this.repo.listarDisponiblesParaMula();
    }
}
