export interface GastoPorCategoria {
    id_categoria: number;
    categoria: string;
    color: string | null;
    total: number;
}

export interface TotalesPorMes {
    ingresos_tesoreria: number;
    cobros_cxc: number;
    gastos_cxp: number;
}

export interface TransaccionLibro {
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

export interface IFlujoCajaRepository {
    ingresosTesoreriaDelMes(mes: number, anio: number): Promise<number>;
    cobrosCxCDelMes(mes: number, anio: number): Promise<number>;
    gastosCxPDelMes(mes: number, anio: number): Promise<number>;
    gastosCxPPorCategoriaDelMes(mes: number, anio: number): Promise<GastoPorCategoria[]>;
    gastosCxPPorCategoriaHistorico(): Promise<GastoPorCategoria[]>;
    totalesHistoricos(): Promise<{ ingresos_tesoreria: number; cobros_cxc: number; gastos_cxp: number }>;
    // Un total por cada uno de los 3 movimientos de caja, agrupado por mes (1-12) del año dado.
    totalesPorMesDelAnio(anio: number): Promise<Map<number, TotalesPorMes>>;

    // Libro de transacciones: cada abono/cobro real del período, uno por fila (no agregado).
    libroGastos(mes: number, anio: number): Promise<TransaccionLibro[]>;
    libroCobros(mes: number, anio: number): Promise<TransaccionLibro[]>;
}
