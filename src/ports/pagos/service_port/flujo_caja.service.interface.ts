export interface GastoPorCategoriaDTO {
    categoria: string;
    color: string | null;
    total: number;
}

export interface ResumenFlujoCaja {
    periodo: { mes: number; anio: number };
    ingresos: { tesoreria: number; cobros_cxc: number; total: number };
    gastos: { total: number; por_categoria: GastoPorCategoriaDTO[] };
    saldo_mes: number;
    saldo_acumulado_historico: number;
}

export interface HistoricoFlujoCaja {
    ingresos_total: number;
    gastos_total: number;
    gastos_por_categoria: GastoPorCategoriaDTO[];
    saldo_acumulado: number;
}

export interface IFlujoCajaService {
    resumenMensual(mes: number, anio: number): Promise<ResumenFlujoCaja>;
    historico(): Promise<HistoricoFlujoCaja>;
}
