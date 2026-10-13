import { NominaLiquidacionSQL } from '../../../models/nomina/sql/nomina_liquidacion.sql';

/**
 * Un renglón por cada Turno de la quincena: qué % de recargo llevó (propio + nocturno + festivo,
 * ya sumados) y cuánto se pagó por ese turno puntual. Para POR_DIAS, `horas_*`/`recargo_pct_
 * nocturno` no aplican (se paga por día completo) y quedan en null/0.
 */
export interface DetalleTurnoLiquidacion {
    fecha: string;
    id_tipo_turno: number;
    nombre_turno: string | null;
    horas_trabajadas: number | null;
    es_domingo: boolean;
    es_festivo: boolean;
    horas_diurnas: number | null;
    horas_nocturnas: number | null;
    /** % total (recargo propio del turno + festivo si aplica) sobre la parte diurna. */
    recargo_pct_diurno: number;
    /** % total (recargo propio + 35% nocturno + festivo si aplica) sobre la parte nocturna; 0 si no tiene horas nocturnas. */
    recargo_pct_nocturno: number;
    monto: number;
}

export interface PreviewLiquidacion {
    id_empleado: number;
    anio: number;
    mes: number;
    quincena: 1 | 2;
    tipo_pago: 'FIJO_MENSUAL' | 'POR_DIAS' | 'POR_HORAS';
    unidades: number | null;
    tarifa_aplicada: number;
    monto_bruto: number;
    total_recargo_dominical_festivo: number;
    detalle_turnos: DetalleTurnoLiquidacion[];
    total_bonos_periodo: number;
    total_descuento_prestamo: number;
    prestamos_a_descontar: { id_prestamo: number; cuota: number }[];
    aporte_salud: number;
    aporte_pension: number;
    total_aportes_seguridad_social: number;
    otros_descuentos: number;
    monto_neto: number;
    ya_liquidada: boolean;
}

export interface PrestacionesSociales {
    id_empleado: number;
    anio: number;
    tipo_pago: 'FIJO_MENSUAL' | 'POR_DIAS' | 'POR_HORAS';
    base_mensual: number;
    meses_trabajados: number;
    cesantias: number;
    intereses_cesantias: number;
    prima: number;
    vacaciones: number;
    total_provisionado: number;
}

export interface PreviewLiquidacionError {
    id_empleado: number;
    message: string;
}

export interface PreviewGrupalResult {
    previews: PreviewLiquidacion[];
    errores: PreviewLiquidacionError[];
}

export interface INominaLiquidacionService {
    previsualizar(id_empleado: number, anio: number, mes: number, quincena: number): Promise<PreviewLiquidacion>;
    previsualizarGrupal(anio: number, mes: number, quincena: number): Promise<PreviewGrupalResult>;
    confirmar(data: { id_empleado: number; anio: number; mes: number; quincena: number; otros_descuentos?: number }): Promise<NominaLiquidacionSQL>;
    listar(filtros: { id_empleado?: number; anio?: number; mes?: number }): Promise<NominaLiquidacionSQL[]>;
    obtenerPorId(id: number): Promise<NominaLiquidacionSQL | null>;
    calcularPrestaciones(id_empleado: number, anio: number): Promise<PrestacionesSociales>;

    /** Persiste la previsualización como borrador editable (estado='borrador', sin CxP todavía). */
    crearBorrador(data: { id_empleado: number; anio: number; mes: number; quincena: number; otros_descuentos?: number }): Promise<NominaLiquidacionSQL>;
    /** Edita `otros_descuentos` de un borrador (409 si ya está confirmado). */
    actualizarBorrador(id: number, data: { otros_descuentos: number }): Promise<NominaLiquidacionSQL>;
    /** Promueve un borrador a confirmado: recalcula bruto/bonos/préstamos en caliente, genera la CxP y descuenta cuotas. */
    confirmarBorrador(id: number): Promise<NominaLiquidacionSQL>;
}
