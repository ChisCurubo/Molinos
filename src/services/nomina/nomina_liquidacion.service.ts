import { Pool, PoolConnection } from 'mysql2/promise';
import { INominaLiquidacionRepository } from '../../ports/nomina/repository_port/nomina_liquidacion.repository.interface';
import { INominaLiquidacionService, PreviewLiquidacion, PreviewGrupalResult, PrestacionesSociales } from '../../ports/nomina/service_port/nomina_liquidacion.service.interface';
import { IEmpleadoRepository, PrestamoEmpleadoRepositoryInterface } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { IEmpleadoSalarioRepository } from '../../ports/nomina/repository_port/empleado_salario.repository.interface';
import { ITurnoRepository, ITipoTurnoRepository } from '../../ports/nomina/repository_port/turno.repository.interface';
import { IBonoEmpleadoRepository } from '../../ports/nomina/repository_port/bono_empleado.repository.interface';
import { NominaLiquidacionSQL } from '../../models/nomina/sql/nomina_liquidacion.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

function rangoQuincena(anio: number, mes: number, quincena: 1 | 2): { desde: string; hasta: string } {
    const pad = (n: number) => String(n).padStart(2, '0');
    if (quincena === 1) {
        return { desde: `${anio}-${pad(mes)}-01`, hasta: `${anio}-${pad(mes)}-15` };
    }
    const ultimoDia = new Date(anio, mes, 0).getDate(); // día 0 del mes siguiente = último día de este mes
    return { desde: `${anio}-${pad(mes)}-16`, hasta: `${anio}-${pad(mes)}-${pad(ultimoDia)}` };
}

/**
 * Nómina quincenal: paga la mitad del salario fijo el día 15, la otra mitad a fin de mes;
 * para empleados variables (POR_DIAS/POR_HORAS) liquida lo devengado en esa quincena según
 * Turno. Descuenta automáticamente la cuota de cualquier préstamo activo del empleado
 * (Prestamos_Empleados.valor / cuotas, topada al saldo restante de su CxC) como un
 * Abono_CxC con metodo='descuento_nomina'. Ver NOMINA_QUINCENAL_plan.md Fase 2.
 */
export class NominaLiquidacionService implements INominaLiquidacionService {
    constructor(
        private repo: INominaLiquidacionRepository,
        private empleadoRepo: IEmpleadoRepository,
        private salarioRepo: IEmpleadoSalarioRepository,
        private turnoRepo: ITurnoRepository,
        private tipoTurnoRepo: ITipoTurnoRepository,
        private prestamoRepo: PrestamoEmpleadoRepositoryInterface,
        private bonoRepo: IBonoEmpleadoRepository,
        private db: Pool
    ) {}

    private async tx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const out = await fn(conn);
            await conn.commit();
            return out;
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    private validarPeriodo(anio: number, mes: number, quincena: number): asserts quincena is 1 | 2 {
        if (!Number.isInteger(anio) || anio < 2000) throw err('anio inválido');
        if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw err('mes debe estar entre 1 y 12');
        if (quincena !== 1 && quincena !== 2) throw err('quincena debe ser 1 (día 15) o 2 (fin de mes)');
    }

    /**
     * Calcula bruto + descuento de préstamo(s) activo(s) sin persistir nada. Usado tanto
     * por el preview como, internamente, por confirmar().
     */
    private async calcular(id_empleado: number, anio: number, mes: number, quincena: 1 | 2) {
        const empleado = await this.empleadoRepo.getById(id_empleado);
        if (!empleado) throw err('El empleado no existe', 404);

        const salario = await this.salarioRepo.obtenerVigente(id_empleado);
        if (!salario) throw err('El empleado no tiene una configuración salarial vigente (Empleados_Salario)', 409);

        const { desde, hasta } = rangoQuincena(anio, mes, quincena);

        let unidades: number | null = null;
        let monto_bruto = 0;
        if (salario.tipo_pago === 'FIJO_MENSUAL') {
            monto_bruto = r2(Number(salario.tarifa_monto) / 2);
        } else {
            const turnos = (await this.turnoRepo.listByEmpleadoAndQuincena(id_empleado, quincena, mes, anio))
                .filter(t => t.presente !== false); // ausencias (presente=false) no devengan, ya vienen con horas=0
            if (salario.tipo_pago === 'POR_DIAS') {
                unidades = turnos.length;
                monto_bruto = r2(unidades * Number(salario.tarifa_monto));
            } else {
                unidades = turnos.reduce((acc, t) => acc + Number(t.horas_trabajadas || 0), 0);
                // Recargo por tipo de turno (diurno 0% / tarde +25% / nocturno +35%, ver Tipos_Turno):
                // cada turno se paga horas × tarifa × (1 + recargo/100), no una suma plana de horas.
                const tipos = await this.tipoTurnoRepo.list();
                const recargoPorTipo = new Map(tipos.map(t => [t.id, Number(t.recargo_porcentaje || 0)]));
                monto_bruto = r2(turnos.reduce((acc, t) => {
                    const recargo = recargoPorTipo.get(t.id_tipo_turno) || 0;
                    return acc + Number(t.horas_trabajadas || 0) * Number(salario.tarifa_monto) * (1 + recargo / 100);
                }, 0));
            }
        }

        // Descuento automático por cuotas de préstamos activos (saldo pendiente > 0).
        const prestamos = await this.prestamoRepo.listAll({ id_empleado });
        const prestamos_a_descontar: { id_prestamo: number; cuota: number }[] = [];
        let total_descuento_prestamo = 0;
        for (const p of prestamos) {
            const cxc = await this.prestamoRepo.cxcDePrestamo(p.id);
            if (!cxc || cxc.estado === 'cobrado' || cxc.estado === 'anulado') continue;
            const saldo = Number(cxc.saldo);
            if (saldo <= 0) continue;
            const cuotaTeorica = Number(p.valor) / Number(p.cuotas || 1);
            const cuota = r2(Math.min(cuotaTeorica, saldo));
            if (cuota > 0) {
                prestamos_a_descontar.push({ id_prestamo: p.id, cuota });
                total_descuento_prestamo += cuota;
            }
        }
        total_descuento_prestamo = r2(total_descuento_prestamo);

        const total_bonos_periodo = r2(await this.bonoRepo.sumarPorEmpleadoYRango(id_empleado, desde, hasta));

        return {
            empleado, salario, desde, hasta, unidades, monto_bruto,
            total_descuento_prestamo, prestamos_a_descontar, total_bonos_periodo
        };
    }

    async previsualizar(id_empleado: number, anio: number, mes: number, quincena: number): Promise<PreviewLiquidacion> {
        this.validarPeriodo(anio, mes, quincena);
        return this.previsualizarUno(id_empleado, anio, mes, quincena as 1 | 2);
    }

    private async previsualizarUno(id_empleado: number, anio: number, mes: number, quincena: 1 | 2): Promise<PreviewLiquidacion> {
        const c = await this.calcular(id_empleado, anio, mes, quincena);
        const existente = await this.repo.obtenerPorPeriodo(id_empleado, anio, mes, quincena);
        const otros_descuentos = 0;
        const monto_neto = r2(c.monto_bruto + c.total_bonos_periodo - c.total_descuento_prestamo - otros_descuentos);

        return {
            id_empleado, anio, mes, quincena,
            tipo_pago: c.salario.tipo_pago,
            unidades: c.unidades,
            tarifa_aplicada: Number(c.salario.tarifa_monto),
            monto_bruto: c.monto_bruto,
            total_bonos_periodo: c.total_bonos_periodo,
            total_descuento_prestamo: c.total_descuento_prestamo,
            prestamos_a_descontar: c.prestamos_a_descontar,
            otros_descuentos,
            monto_neto,
            ya_liquidada: !!existente
        };
    }

    /**
     * Previsualiza todos los empleados de una quincena en un solo viaje al backend (un request,
     * cálculos corridos en paralelo sobre el mismo pool de conexiones). Un empleado sin
     * configuración salarial vigente (u otro error puntual) no tumba el lote: se reporta en
     * `errores` y el resto de previews se devuelve igual.
     */
    async previsualizarGrupal(anio: number, mes: number, quincena: number): Promise<PreviewGrupalResult> {
        this.validarPeriodo(anio, mes, quincena);
        const q = quincena as 1 | 2;
        const empleados = await this.empleadoRepo.list();

        const resultados = await Promise.all(empleados.map(async (e) => {
            try {
                const preview = await this.previsualizarUno(e.id, anio, mes, q);
                return { ok: true as const, preview };
            } catch (error: any) {
                return { ok: false as const, error: { id_empleado: e.id, message: error?.message || 'Error desconocido' } };
            }
        }));

        return {
            previews: resultados.filter(r => r.ok).map(r => (r as any).preview),
            errores: resultados.filter(r => !r.ok).map(r => (r as any).error)
        };
    }

    /** Descuenta en cascada las cuotas de préstamos activos ya calculadas por `calcular()`, como Abono_CxC. */
    private async aplicarDescuentosPrestamos(prestamos_a_descontar: { id_prestamo: number; cuota: number }[], fecha_liquidacion: string, quincena: number, mes: number, anio: number, conn: PoolConnection): Promise<void> {
        for (const d of prestamos_a_descontar) {
            const cxc = await this.prestamoRepo.cxcDePrestamo(d.id_prestamo, conn);
            if (!cxc) continue;
            await this.prestamoRepo.insertarAbonoCxC({
                id_cxc: cxc.id, fecha_cobro: fecha_liquidacion, valor: d.cuota,
                metodo: 'descuento_nomina',
                observaciones: `Cuota préstamo #${d.id_prestamo} descontada en nómina quincena ${quincena} ${mes}/${anio}`
            }, conn);
            await this.prestamoRepo.recalcularCuentaCobrar(cxc.id, conn);
        }
    }

    async confirmar(data: { id_empleado: number; anio: number; mes: number; quincena: number; otros_descuentos?: number }): Promise<NominaLiquidacionSQL> {
        const { id_empleado, anio, mes, quincena } = data;
        this.validarPeriodo(anio, mes, quincena);
        const otros_descuentos = r2(Number(data.otros_descuentos) || 0);
        if (otros_descuentos < 0) throw err('otros_descuentos no puede ser negativo');

        const existente = await this.repo.obtenerPorPeriodo(id_empleado, anio, mes, quincena);
        if (existente) throw err('Ya existe una liquidación para este empleado en esta quincena', 409);

        const c = await this.calcular(id_empleado, anio, mes, quincena);
        const monto_neto = r2(c.monto_bruto + c.total_bonos_periodo - c.total_descuento_prestamo - otros_descuentos);
        if (monto_neto < 0) throw err('El neto a pagar quedaría negativo; revisa los descuentos', 409);

        const concepto = `Nómina ${c.empleado.nombre} ${c.empleado.apellido} — quincena ${quincena} ${mes}/${anio}`;
        const fecha_liquidacion = quincena === 1 ? `${anio}-${String(mes).padStart(2, '0')}-15` : c.hasta;

        return this.tx(async conn => {
            const idLiquidacion = await this.repo.crear({
                id_empleado, anio, mes, quincena,
                tipo_pago: c.salario.tipo_pago,
                unidades: c.unidades,
                tarifa_aplicada: Number(c.salario.tarifa_monto),
                monto_bruto: c.monto_bruto,
                total_bonos: c.total_bonos_periodo,
                total_descuento_prestamo: c.total_descuento_prestamo,
                otros_descuentos,
                monto_neto,
                fecha_liquidacion
            } as any, conn);

            const idCxp = await this.repo.crearCuentaPagar(
                { id_empleado, concepto, valor_total: monto_neto, fecha_creacion: fecha_liquidacion }, conn
            );
            await this.repo.confirmarConCuentaPagar(idLiquidacion, idCxp, conn);
            await this.aplicarDescuentosPrestamos(c.prestamos_a_descontar, fecha_liquidacion, quincena, mes, anio, conn);

            const creada = await this.repo.obtenerPorId(idLiquidacion, conn);
            return creada!;
        });
    }

    /**
     * Persiste la previsualización como borrador editable (estado='borrador', sin CxP ni
     * descuento de préstamo todavía — eso solo pasa al confirmar, ver `confirmarBorrador`).
     */
    async crearBorrador(data: { id_empleado: number; anio: number; mes: number; quincena: number; otros_descuentos?: number }): Promise<NominaLiquidacionSQL> {
        const { id_empleado, anio, mes, quincena } = data;
        this.validarPeriodo(anio, mes, quincena);
        const otros_descuentos = r2(Number(data.otros_descuentos) || 0);
        if (otros_descuentos < 0) throw err('otros_descuentos no puede ser negativo');

        const existente = await this.repo.obtenerPorPeriodo(id_empleado, anio, mes, quincena);
        if (existente) throw err(`Ya existe una liquidación (${existente.estado}) para este empleado en esta quincena`, 409);

        const c = await this.calcular(id_empleado, anio, mes, quincena as 1 | 2);
        const monto_neto = r2(c.monto_bruto + c.total_bonos_periodo - c.total_descuento_prestamo - otros_descuentos);
        if (monto_neto < 0) throw err('El neto a pagar quedaría negativo; revisa los descuentos', 409);

        const id = await this.repo.crearBorrador({
            id_empleado, anio, mes, quincena,
            tipo_pago: c.salario.tipo_pago,
            unidades: c.unidades,
            tarifa_aplicada: Number(c.salario.tarifa_monto),
            monto_bruto: c.monto_bruto,
            total_bonos: c.total_bonos_periodo,
            total_descuento_prestamo: c.total_descuento_prestamo,
            otros_descuentos,
            monto_neto,
            fecha_liquidacion: c.hasta
        } as any);
        return (await this.repo.obtenerPorId(id))!;
    }

    async actualizarBorrador(id: number, data: { otros_descuentos: number }): Promise<NominaLiquidacionSQL> {
        const row = await this.repo.obtenerPorId(id);
        if (!row) throw err('Liquidación no encontrada', 404);
        if (row.estado !== 'borrador') throw err('Esta liquidación ya fue confirmada y no se puede editar', 409);

        const otros_descuentos = r2(Number(data.otros_descuentos));
        if (!Number.isFinite(otros_descuentos) || otros_descuentos < 0) throw err('otros_descuentos no puede ser negativo');
        const monto_neto = r2(Number(row.monto_bruto) + Number(row.total_bonos) - Number(row.total_descuento_prestamo) - otros_descuentos);
        if (monto_neto < 0) throw err('El neto a pagar quedaría negativo; revisa los descuentos', 409);

        await this.repo.actualizarBorrador(id, { otros_descuentos, monto_neto });
        return (await this.repo.obtenerPorId(id))!;
    }

    /**
     * Promueve un borrador a confirmado. Recalcula bruto/bonos/préstamos en caliente (pueden
     * haber cambiado desde que se creó el borrador) pero conserva el `otros_descuentos` que el
     * usuario ajustó manualmente ahí.
     */
    async confirmarBorrador(id: number): Promise<NominaLiquidacionSQL> {
        const row = await this.repo.obtenerPorId(id);
        if (!row) throw err('Liquidación no encontrada', 404);
        if (row.estado !== 'borrador') throw err('Esta liquidación ya está confirmada', 409);

        const c = await this.calcular(row.id_empleado, row.anio, row.mes, row.quincena);
        const otros_descuentos = Number(row.otros_descuentos);
        const monto_neto = r2(c.monto_bruto + c.total_bonos_periodo - c.total_descuento_prestamo - otros_descuentos);
        if (monto_neto < 0) throw err('El neto a pagar quedaría negativo; revisa los descuentos', 409);

        const concepto = `Nómina ${c.empleado.nombre} ${c.empleado.apellido} — quincena ${row.quincena} ${row.mes}/${row.anio}`;
        const fecha_liquidacion = row.quincena === 1 ? `${row.anio}-${String(row.mes).padStart(2, '0')}-15` : c.hasta;

        return this.tx(async conn => {
            const idCxp = await this.repo.crearCuentaPagar(
                { id_empleado: row.id_empleado, concepto, valor_total: monto_neto, fecha_creacion: fecha_liquidacion }, conn
            );
            await this.repo.confirmarBorrador(id, idCxp, {
                tipo_pago: c.salario.tipo_pago,
                unidades: c.unidades,
                tarifa_aplicada: Number(c.salario.tarifa_monto),
                monto_bruto: c.monto_bruto,
                total_bonos: c.total_bonos_periodo,
                total_descuento_prestamo: c.total_descuento_prestamo,
                monto_neto,
                fecha_liquidacion
            }, conn);
            await this.aplicarDescuentosPrestamos(c.prestamos_a_descontar, fecha_liquidacion, row.quincena, row.mes, row.anio, conn);

            const creada = await this.repo.obtenerPorId(id, conn);
            return creada!;
        });
    }

    async listar(filtros: { id_empleado?: number; anio?: number; mes?: number }): Promise<NominaLiquidacionSQL[]> {
        return this.repo.listar(filtros);
    }

    async obtenerPorId(id: number): Promise<NominaLiquidacionSQL | null> {
        return this.repo.obtenerPorId(id);
    }

    /**
     * Prestaciones sociales de ley (Colombia), calculadas — no apartadas ni pagadas.
     * Base: FIJO_MENSUAL usa la tarifa vigente; variable usa el promedio mensual devengado
     * (SUM(monto_bruto) del año / meses con al menos una liquidación confirmada).
     * meses_trabajados = meses distintos con liquidación confirmada en el año, para AMBOS
     * tipos de pago (así la provisión refleja lo realmente liquidado, no un supuesto).
     */
    async calcularPrestaciones(id_empleado: number, anio: number): Promise<PrestacionesSociales> {
        if (!Number.isInteger(anio) || anio < 2000) throw err('anio inválido');
        const empleado = await this.empleadoRepo.getById(id_empleado);
        if (!empleado) throw err('El empleado no existe', 404);
        const salario = await this.salarioRepo.obtenerVigente(id_empleado);
        if (!salario) throw err('El empleado no tiene una configuración salarial vigente (Empleados_Salario)', 409);

        const liquidacionesDelAnio = await this.repo.listar({ id_empleado, anio });
        const mesesConActividad = new Set(liquidacionesDelAnio.map(l => l.mes));
        const meses_trabajados = mesesConActividad.size;

        let base_mensual: number;
        if (salario.tipo_pago === 'FIJO_MENSUAL') {
            base_mensual = Number(salario.tarifa_monto);
        } else {
            const sumaBruto = liquidacionesDelAnio.reduce((acc, l) => acc + Number(l.monto_bruto), 0);
            base_mensual = meses_trabajados > 0 ? r2(sumaBruto / meses_trabajados) : 0;
        }

        const fraccionAnio = meses_trabajados / 12;
        const cesantias = r2(base_mensual * 0.0833 * fraccionAnio);
        const intereses_cesantias = r2(cesantias * 0.12 * fraccionAnio);
        const prima = r2(base_mensual * 0.0833 * fraccionAnio);
        const vacaciones = r2(base_mensual * 0.0417 * fraccionAnio);
        const total_provisionado = r2(cesantias + intereses_cesantias + prima + vacaciones);

        return {
            id_empleado, anio, tipo_pago: salario.tipo_pago,
            base_mensual, meses_trabajados,
            cesantias, intereses_cesantias, prima, vacaciones, total_provisionado
        };
    }
}
