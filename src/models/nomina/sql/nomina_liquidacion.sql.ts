export interface NominaLiquidacionSQL {
    id: number;
    id_empleado: number;
    anio: number;
    mes: number;
    quincena: 1 | 2;
    tipo_pago: 'FIJO_MENSUAL' | 'POR_DIAS' | 'POR_HORAS';
    unidades: number | null;
    tarifa_aplicada: number;
    monto_bruto: number;
    total_recargo_dominical_festivo: number;
    total_bonos: number;
    total_descuento_prestamo: number;
    aporte_salud: number;
    aporte_pension: number;
    total_aportes_seguridad_social: number;
    otros_descuentos: number;
    monto_neto: number;
    id_cuenta_pagar: number | null;
    estado: 'borrador' | 'confirmado';
    fecha_liquidacion: Date;
    created_at: Date;
}
