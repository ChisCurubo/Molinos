// Objeto APP para la entidad de dominio de negocio

export interface EmpleadoSalarioApp {
    id: number;
    empleado_id: number;
    tipo_pago: 'FIJO_MENSUAL' | 'POR_DIAS' | 'POR_HORAS';
    tarifa_monto: number;
    aplica_aux_transp: boolean;
    fecha_inicio: Date;
    activo: boolean;
    created_at: Date;
}
