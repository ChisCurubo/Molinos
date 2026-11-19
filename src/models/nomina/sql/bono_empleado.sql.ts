export interface BonoEmpleadoSQL {
    id: number;
    id_empleado: number;
    fecha: Date;
    concepto: string;
    valor: number;
    id_cuenta_pagar: number | null;
    created_at: Date;
}
