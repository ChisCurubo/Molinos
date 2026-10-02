export interface GastoPorCategoria {
    id_categoria: number;
    categoria: string;
    color: string | null;
    total: number;
}

export interface IFlujoCajaRepository {
    ingresosTesoreriaDelMes(mes: number, anio: number): Promise<number>;
    cobrosCxCDelMes(mes: number, anio: number): Promise<number>;
    gastosCxPDelMes(mes: number, anio: number): Promise<number>;
    gastosCxPPorCategoriaDelMes(mes: number, anio: number): Promise<GastoPorCategoria[]>;
    gastosCxPPorCategoriaHistorico(): Promise<GastoPorCategoria[]>;
    totalesHistoricos(): Promise<{ ingresos_tesoreria: number; cobros_cxc: number; gastos_cxp: number }>;
}
