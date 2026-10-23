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

export interface MesFlujoCaja {
    mes: number;
    ingresos: number;
    gastos: number;
    saldo_mes: number;
}

export interface FlujoCajaAnual {
    anio: number;
    ingresos_total: number;
    gastos_total: number;
    saldo_anio: number;
    meses: MesFlujoCaja[];
}

export interface TransaccionLibroDTO {
    id: number;
    fecha: string;
    categoria: string;
    color: string | null;
    concepto: string;
    beneficiario: string | null;
    monto: number;
    metodo_pago: string;
    comprobante_url: string | null;
    observaciones: string | null;
}

export interface IFlujoCajaService {
    resumenMensual(mes: number, anio: number): Promise<ResumenFlujoCaja>;
    historico(): Promise<HistoricoFlujoCaja>;
    anual(anio: number): Promise<FlujoCajaAnual>;
    libroGastos(mes: number, anio: number): Promise<TransaccionLibroDTO[]>;
    libroCobros(mes: number, anio: number): Promise<TransaccionLibroDTO[]>;
}
