import { Pool } from 'mysql2/promise';
import { IViajesRepository } from '../../ports/material/viajes.interface';
import { TriggerLogicRepository } from '../../ports/db_triggers/trigger_logic.repository.interface';

export class ViajesService {
    private repo: IViajesRepository;
    private db: Pool;
    private triggerLogicRepo: TriggerLogicRepository;

    constructor(repo: IViajesRepository, db: Pool, triggerLogicRepo: TriggerLogicRepository) {
        this.repo = repo;
        this.db = db;
        this.triggerLogicRepo = triggerLogicRepo;
    }

    async crearCabeceraViaje(data: any): Promise<number> {
        return await this.repo.crearCabeceraViaje(data);
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
        const porLote = new Map<number, any[]>();
        for (const a of aportes) {
            const k = Number(a.id_lote);
            const totalSeco = totalSecoPorLote.get(k) || 0;
            const seco = Number(a.toneladas_seco_aportadas) || 0;
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

    /**
     * Asigna un lote de concentrado a un viaje.
     * El front SOLO envía id_material_concentrado y (opcional) total_concentrado_humedo
     * (cuánto despachar; si se omite, se despacha todo lo disponible del lote).
     * El resto de campos se DERIVAN del lote y de su análisis de concentrado (tipo 2):
     *   - porcentaje_humedad, concentrado_seco, peso_humedad
     *   - tenor_au_venta / tenor_ag (del análisis), total_grs_au/ag_venta
     * costo_maquila y el descuento de stock los manejan los triggers de BD.
     */
    async asignarLoteAViajeTx(data: any): Promise<number> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const lote = await this.repo.obtenerLoteConAnalisis(data.id_material_concentrado, conn);
            if (!lote) throw new Error('Lote de concentrado no encontrado');

            const disponible = Number(lote.toneladas_disponibles) || 0;
            if (disponible <= 0) throw new Error('El lote no tiene concentrado disponible para despachar');

            const humedad = Number(lote.porcentaje_humedad) || 0;
            const cantidad = (data.total_concentrado_humedo === undefined || data.total_concentrado_humedo === null)
                ? disponible
                : Number(data.total_concentrado_humedo);

            if (cantidad <= 0) throw new Error('La cantidad de concentrado a despachar debe ser mayor a 0');
            if (cantidad > disponible + 1e-6) {
                throw new Error(`Solo hay ${disponible} t húmedas disponibles en el lote; se solicitaron ${cantidad}`);
            }

            const r4 = (n: number) => Math.round(n * 10000) / 10000;
            const concentrado_seco = r4(cantidad * (1 - humedad));
            const peso_humedad = r4(cantidad - concentrado_seco);
            const tenor_au = Number(lote.tenor_au) || 0;
            const tenor_ag = Number(lote.tenor_ag) || 0;

            const payload = {
                id_viaje: data.id_viaje,
                id_material_concentrado: data.id_material_concentrado,
                total_concentrado_humedo: r4(cantidad),
                concentrado_seco,
                porcentaje_humedad: humedad,
                peso_humedad,
                es_remanente: data.es_remanente || 0,
                id_viaje_origen: data.id_viaje_origen || null,
                concepto: data.concepto || lote.codigo,
                valor_total_con_gastos: data.valor_total ?? data.valor_total_con_gastos ?? null,
                tenor_au_venta: tenor_au,
                total_grs_au_venta: r4(concentrado_seco * tenor_au),
                tenor_ag: tenor_ag,
                total_grs_ag_venta: r4(concentrado_seco * tenor_ag)
            };

            const id = await this.repo.asignarLoteAViaje(payload, conn);

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
     * Elimina un viaje completo. Borra primero cada línea (el trigger
     * trg_after_delete_viaje_material devuelve el stock al lote y recalcula
     * los totales) y luego la cabecera del viaje.
     */
    async eliminarViajeTx(idViaje: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const viaje = await this.repo.obtenerViajePorId(idViaje, conn);
            if (!viaje) throw new Error('Viaje no encontrado');

            const lineas = await this.repo.obtenerLineasDeViaje(idViaje, conn);
            for (const linea of lineas) {
                // Borrado individual para que el trigger AFTER DELETE devuelva el stock.
                await this.repo.eliminarLineaViaje(linea.id, conn);
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

    async eliminarLineaViajeTx(idLinea: number): Promise<void> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const oldRow = await this.repo.obtenerLineaViajePorId(idLinea, conn);
            if (!oldRow) throw new Error('Línea de viaje no encontrada');

            await this.repo.eliminarLineaViaje(idLinea, conn);

            // TODO: [MIGRACIÓN TRIGGERS] Descomentar la siguiente línea el día que se elimine el trigger 'trg_after_delete_viaje_material' de la BD.
            // await this.triggerLogicRepo.afterDeleteViajeMaterial(conn, oldRow);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}
