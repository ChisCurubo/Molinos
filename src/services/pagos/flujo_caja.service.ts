import { IFlujoCajaRepository } from '../../ports/pagos/repository_port/flujo_caja.repository.interface';
import { IFlujoCajaService, ResumenFlujoCaja, HistoricoFlujoCaja } from '../../ports/pagos/service_port/flujo_caja.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Flujo de caja: ingresos vs. gastos REALES de la empresa. Solo cuenta movimientos de
 * dinero de verdad — excluye compensaciones internas (saldo_a_favor, descuento_nomina,
 * descuento_flete), que no son entradas/salidas de caja sino que netean una deuda contra
 * otra (ver el comentario en flujo_caja.repository.ts para el detalle de cada método).
 */
export class FlujoCajaService implements IFlujoCajaService {
    constructor(private repo: IFlujoCajaRepository) {}

    async resumenMensual(mes: number, anio: number): Promise<ResumenFlujoCaja> {
        if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw err('mes debe estar entre 1 y 12');
        if (!Number.isInteger(anio) || anio < 2000) throw err('anio inválido');

        const [tesoreria, cobros_cxc, gastos, por_categoria, historico] = await Promise.all([
            this.repo.ingresosTesoreriaDelMes(mes, anio),
            this.repo.cobrosCxCDelMes(mes, anio),
            this.repo.gastosCxPDelMes(mes, anio),
            this.repo.gastosCxPPorCategoriaDelMes(mes, anio),
            this.repo.totalesHistoricos()
        ]);

        const ingresos_total = r2(tesoreria + cobros_cxc);
        const saldo_mes = r2(ingresos_total - gastos);
        const saldo_acumulado_historico = r2(historico.ingresos_tesoreria + historico.cobros_cxc - historico.gastos_cxp);

        return {
            periodo: { mes, anio },
            ingresos: { tesoreria: r2(tesoreria), cobros_cxc: r2(cobros_cxc), total: ingresos_total },
            gastos: {
                total: r2(gastos),
                por_categoria: por_categoria.map(c => ({ categoria: c.categoria, color: c.color, total: r2(c.total) }))
            },
            saldo_mes,
            saldo_acumulado_historico
        };
    }

    async historico(): Promise<HistoricoFlujoCaja> {
        const [t, por_categoria] = await Promise.all([
            this.repo.totalesHistoricos(),
            this.repo.gastosCxPPorCategoriaHistorico()
        ]);
        const ingresos_total = r2(t.ingresos_tesoreria + t.cobros_cxc);
        const gastos_total = r2(t.gastos_cxp);
        return {
            ingresos_total,
            gastos_total,
            gastos_por_categoria: por_categoria.map(c => ({ categoria: c.categoria, color: c.color, total: r2(c.total) })),
            saldo_acumulado: r2(ingresos_total - gastos_total)
        };
    }
}
