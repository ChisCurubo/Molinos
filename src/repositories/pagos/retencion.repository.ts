import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { FiltrosRetencionesAplicadas, IRetencionRepository } from '../../ports/pagos/repository_port/retencion.repository.interface';
import { ConceptoRetencionSQL, RetencionAplicadaSQL } from '../../models/pagos/sql/retencion.sql';
import { AppError } from '../../errors/app-error';

export class RetencionRepository implements IRetencionRepository {
    constructor(private db: Pool) {}

    async list(): Promise<ConceptoRetencionSQL[]> {
        const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT * FROM Conceptos_Retencion ORDER BY nombre`);
        return rows as ConceptoRetencionSQL[];
    }

    async listarAplicados(filtros: FiltrosRetencionesAplicadas): Promise<RetencionAplicadaSQL[]> {
        const where: string[] = [];
        const params: any[] = [];
        if (filtros.id_cuenta_pagar) { where.push('ra.id_cuenta_pagar = ?'); params.push(filtros.id_cuenta_pagar); }
        if (filtros.tipo) { where.push('ra.tipo = ?'); params.push(filtros.tipo); }
        if (filtros.desde) { where.push('ra.fecha >= ?'); params.push(filtros.desde); }
        if (filtros.hasta) { where.push('ra.fecha <= ?'); params.push(filtros.hasta); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await this.db.execute<RowDataPacket[]>(
            `SELECT ra.*, cr.nombre AS concepto, cp.concepto AS cuenta_concepto
             FROM Retenciones_Aplicadas ra
             JOIN Conceptos_Retencion cr ON cr.id = ra.id_concepto_retencion
             JOIN Cuentas_Por_Pagar cp   ON cp.id = ra.id_cuenta_pagar
             ${whereSql}
             ORDER BY ra.fecha DESC, ra.id DESC`,
            params
        );
        return rows as RetencionAplicadaSQL[];
    }

    async obtenerAplicada(id: number, conn?: PoolConnection): Promise<any> {
        const [rows] = await (conn || this.db).execute<RowDataPacket[]>(
            `SELECT * FROM Retenciones_Aplicadas WHERE id = ?`, [id]
        );
        return rows.length ? rows[0] : null;
    }
}

export interface RetencionCalculada {
    id_concepto_retencion: number | null;
    tarifa_aplicada: number;
    valor_retenido: number;
}

/** Núcleo compartido por retefuente y reteIVA: dado un concepto YA resuelto, aplica proveedor/UVT/base mínima. */
async function calcularSobreConcepto(
    conn: Pool | PoolConnection,
    idConcepto: number | null,
    idProveedor: number,
    valorBase: number
): Promise<RetencionCalculada> {
    if (!idConcepto) return { id_concepto_retencion: null, tarifa_aplicada: 0, valor_retenido: 0 };

    const [conceptoRows] = await conn.execute<RowDataPacket[]>(
        `SELECT tarifa_declarante, tarifa_no_declarante, base_minima_uvt, activo
         FROM Conceptos_Retencion WHERE id = ?`, [idConcepto]
    );
    if (!conceptoRows.length || !conceptoRows[0].activo) {
        return { id_concepto_retencion: idConcepto, tarifa_aplicada: 0, valor_retenido: 0 };
    }

    const [provRows] = await conn.execute<RowDataPacket[]>(
        `SELECT declarante_renta, exento_retencion FROM Proveedores WHERE id = ?`, [idProveedor]
    );
    if (!provRows.length || provRows[0].exento_retencion) {
        return { id_concepto_retencion: idConcepto, tarifa_aplicada: 0, valor_retenido: 0 };
    }

    const concepto = conceptoRows[0];
    const tarifa = Number(provRows[0].declarante_renta ? concepto.tarifa_declarante : concepto.tarifa_no_declarante);

    const [uvtRows] = await conn.execute<RowDataPacket[]>(`SELECT valor FROM Uvt_Vigente ORDER BY anio DESC LIMIT 1`);
    const uvt = uvtRows.length ? Number(uvtRows[0].valor) : 0;
    const baseMinimaPesos = Number(concepto.base_minima_uvt) * uvt;
    if (Number(valorBase) < baseMinimaPesos) {
        return { id_concepto_retencion: idConcepto, tarifa_aplicada: tarifa, valor_retenido: 0 };
    }

    const valorRetenido = Math.round(Number(valorBase) * tarifa / 100 * 100) / 100;
    return { id_concepto_retencion: idConcepto, tarifa_aplicada: tarifa, valor_retenido: valorRetenido };
}

/**
 * Resuelve cuánto retener en la fuente (renta) para una CxP que está por crearse, SIN escribir
 * nada todavía — así se puede usar el resultado para prellenar valor_total/valor_pagado antes de
 * insertar la fila. Devuelve 0 si: la categoría no tiene concepto asociado (Material, Flete
 * volqueta y Agua quedan así a propósito en esta fase), el concepto está inactivo, el proveedor
 * está exento_retencion, o el valor base no alcanza la base mínima en UVT.
 */
export async function calcularRetencionFuente(
    conn: Pool | PoolConnection,
    p: { id_categoria: number; id_proveedor: number; valor_base: number }
): Promise<RetencionCalculada> {
    const [catRows] = await conn.execute<RowDataPacket[]>(
        `SELECT id_concepto_retencion FROM Categorias_CxP WHERE id = ?`, [p.id_categoria]
    );
    const idConcepto = catRows.length ? catRows[0].id_concepto_retencion : null;
    return calcularSobreConcepto(conn, idConcepto, p.id_proveedor, p.valor_base);
}

/**
 * Fase 2 — ReteIVA, "control básico". Mismo mecanismo que calcularRetencionFuente pero la base es
 * valor_iva (no el valor bruto de la compra) y el concepto es 'ReteIVA general' (15%, vía
 * Categorias_CxP.id_concepto_reteiva). Hoy ese concepto está INACTIVO a propósito — ver
 * migracion_retenciones_2026-10-31.sql — así que esta función devuelve 0 mientras nadie
 * confirme que Molinos es agente de reteIVA y active la fila en Conceptos_Retencion.
 */
export async function calcularReteIva(
    conn: Pool | PoolConnection,
    p: { id_categoria: number; id_proveedor: number; valor_iva: number }
): Promise<RetencionCalculada> {
    if (!(Number(p.valor_iva) > 0)) return { id_concepto_retencion: null, tarifa_aplicada: 0, valor_retenido: 0 };
    const [catRows] = await conn.execute<RowDataPacket[]>(
        `SELECT id_concepto_reteiva FROM Categorias_CxP WHERE id = ?`, [p.id_categoria]
    );
    const idConcepto = catRows.length ? catRows[0].id_concepto_reteiva : null;
    return calcularSobreConcepto(conn, idConcepto, p.id_proveedor, p.valor_iva);
}

/**
 * Inserta el histórico de la retención (fuente o iva) — llamarla con la MISMA conexión del
 * INSERT/UPDATE de la CxP. No hace nada si no hay concepto. Si valor_retenido es 0 Y no fue un
 * ajuste manual, tampoco (nada que registrar: el catálogo simplemente no aplicó nada). Si fue un
 * ajuste manual (ajustado_manualmente=true), SÍ se registra aunque quede en 0 — es el rastro de
 * que alguien decidió explícitamente "esto no aplica" en vez de que el catálogo nunca lo calculara.
 */
export async function registrarRetencionAplicada(
    conn: Pool | PoolConnection,
    p: { id_concepto_retencion: number | null; id_cuenta_pagar: number; valor_base: number; tarifa_aplicada: number; valor_retenido: number; fecha: string | Date; tipo?: 'fuente' | 'iva'; ajustado_manualmente?: boolean; valor_calculado_original?: number | null }
): Promise<void> {
    if (!p.id_concepto_retencion) return;
    if (!(p.valor_retenido > 0) && !p.ajustado_manualmente) return;
    await conn.execute<ResultSetHeader>(
        `INSERT INTO Retenciones_Aplicadas (id_concepto_retencion, id_cuenta_pagar, valor_base, tarifa_aplicada, valor_retenido, tipo, fecha, ajustado_manualmente, valor_calculado_original)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id_concepto_retencion, p.id_cuenta_pagar, p.valor_base, p.tarifa_aplicada, p.valor_retenido, p.tipo ?? 'fuente', p.fecha,
         p.ajustado_manualmente ?? false, p.valor_calculado_original ?? null]
    );
}

/**
 * Aplica un override manual (si viene) sobre un cálculo automático ya resuelto — úsala en el
 * momento de CREAR la CxP, para poder decir desde ya "aplica esto" o "no aplica" sin depender de
 * un PATCH posterior. valorManual puede ser 0 (fuerza "no aplica" aunque el catálogo hubiera
 * calculado algo) — solo `undefined`/`null` significa "deja que decida el catálogo".
 */
export function aplicarOverrideManual(
    calc: RetencionCalculada,
    valorManual: number | null | undefined
): RetencionCalculada & { ajustado_manualmente: boolean; valor_calculado_original: number | null } {
    if (valorManual === undefined || valorManual === null) {
        return { ...calc, ajustado_manualmente: false, valor_calculado_original: null };
    }
    return {
        id_concepto_retencion: calc.id_concepto_retencion,
        tarifa_aplicada: calc.tarifa_aplicada,
        valor_retenido: Math.round(Number(valorManual) * 100) / 100,
        ajustado_manualmente: true,
        valor_calculado_original: calc.valor_retenido
    };
}

/**
 * Recalcula UN tipo de retención ('fuente' o 'iva') de una CxP ya existente cuyo valor base
 * cambió (Ej: PATCH del valor o del valor_iva de una Mula antes de tener abonos reales) —
 * reemplaza el histórico de ESE tipo para esa cuenta. El llamador sigue siendo responsable de
 * actualizar Cuentas_Por_Pagar.valor_total/valor_iva/valor_retenido y de recalcular valor_pagado.
 */
export async function reemplazarRetencionDeCuenta(
    conn: PoolConnection,
    idCuentaPagar: number,
    calc: RetencionCalculada & { ajustado_manualmente?: boolean; valor_calculado_original?: number | null },
    valorBase: number,
    fecha: string | Date,
    tipo: 'fuente' | 'iva' = 'fuente'
): Promise<void> {
    await conn.execute(`DELETE FROM Retenciones_Aplicadas WHERE id_cuenta_pagar = ? AND tipo = ?`, [idCuentaPagar, tipo]);
    await registrarRetencionAplicada(conn, {
        id_concepto_retencion: calc.id_concepto_retencion,
        id_cuenta_pagar: idCuentaPagar,
        valor_base: valorBase,
        tarifa_aplicada: calc.tarifa_aplicada,
        valor_retenido: calc.valor_retenido,
        fecha,
        tipo,
        ajustado_manualmente: calc.ajustado_manualmente,
        valor_calculado_original: calc.valor_calculado_original
    });
}

/**
 * Diseño "híbrido" (decisión del usuario, 2026-10-31): el catálogo sigue resolviendo la tarifa
 * automáticamente, pero cada retención aplicada se puede CORREGIR A MANO cuando algo no calza
 * (ej. un caso especial que el catálogo no contempla). Guarda el valor original la primera vez
 * que se ajusta (no lo pisa en ajustes posteriores) y recalcula Cuentas_Por_Pagar.valor_retenido
 * como la SUMA real de todas sus retenciones (fuente + iva) — así nunca queda desincronizado.
 * Lanza error si el nuevo total retenido deja la cuenta por encima de su valor_total.
 */
export async function ajustarRetencionAplicada(
    conn: PoolConnection,
    idRetencionAplicada: number,
    nuevoValorRetenido: number
): Promise<void> {
    if (!(nuevoValorRetenido >= 0)) throw AppError.validacion('El valor retenido no puede ser negativo');

    const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT id_cuenta_pagar, valor_retenido, ajustado_manualmente, valor_calculado_original
         FROM Retenciones_Aplicadas WHERE id = ?`, [idRetencionAplicada]
    );
    if (!rows.length) throw AppError.noEncontrado('Retención aplicada no encontrada');
    const fila = rows[0];
    const idCuentaPagar = Number(fila.id_cuenta_pagar);
    const valorOriginal = fila.ajustado_manualmente ? Number(fila.valor_calculado_original) : Number(fila.valor_retenido);

    const [cuentaRows] = await conn.execute<RowDataPacket[]>(
        `SELECT valor_total FROM Cuentas_Por_Pagar WHERE id = ?`, [idCuentaPagar]
    );
    if (!cuentaRows.length) throw AppError.noEncontrado('Cuenta por pagar no encontrada');
    const valorTotal = Number(cuentaRows[0].valor_total);

    const [sumRows] = await conn.execute<RowDataPacket[]>(
        `SELECT
            COALESCE((SELECT SUM(valor) FROM Abonos_CxP WHERE id_cuenta_pagar = ?), 0) AS abonos,
            COALESCE((SELECT SUM(valor_retenido) FROM Retenciones_Aplicadas WHERE id_cuenta_pagar = ? AND id != ?), 0) AS otras_retenciones`,
        [idCuentaPagar, idCuentaPagar, idRetencionAplicada]
    );
    const totalConElAjuste = Number(sumRows[0].abonos) + Number(sumRows[0].otras_retenciones) + nuevoValorRetenido;
    if (totalConElAjuste > valorTotal + 1e-6) {
        throw AppError.reglaNegocio(`El ajuste deja el total pagado (${totalConElAjuste}) por encima del valor de la cuenta (${valorTotal})`);
    }

    await conn.execute(
        `UPDATE Retenciones_Aplicadas SET valor_retenido = ?, ajustado_manualmente = TRUE, valor_calculado_original = ? WHERE id = ?`,
        [nuevoValorRetenido, valorOriginal, idRetencionAplicada]
    );

    // valor_retenido de la cuenta = SUMA real de todas sus retenciones (fuente + iva), para que
    // nunca quede desincronizado del histórico que es la fuente de verdad.
    await conn.execute(
        `UPDATE Cuentas_Por_Pagar cp
         SET valor_retenido = (SELECT COALESCE(SUM(valor_retenido),0) FROM Retenciones_Aplicadas WHERE id_cuenta_pagar = cp.id),
             valor_pagado   = (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id)
                             + (SELECT COALESCE(SUM(valor_retenido),0) FROM Retenciones_Aplicadas WHERE id_cuenta_pagar = cp.id),
             estado = CASE
                WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id)
                   + (SELECT COALESCE(SUM(valor_retenido),0) FROM Retenciones_Aplicadas WHERE id_cuenta_pagar = cp.id) <= 0 THEN 'pendiente'
                WHEN (SELECT COALESCE(SUM(valor),0) FROM Abonos_CxP WHERE id_cuenta_pagar = cp.id)
                   + (SELECT COALESCE(SUM(valor_retenido),0) FROM Retenciones_Aplicadas WHERE id_cuenta_pagar = cp.id) >= cp.valor_total THEN 'pagado'
                ELSE 'parcial' END
         WHERE cp.id = ? AND cp.estado != 'anulado'`,
        [idCuentaPagar]
    );
}
