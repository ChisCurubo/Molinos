export interface CuentaBancariaSQL {
    id: number;
    nombre: string;
    banco: string | null;
    numero_cuenta: string | null;
    tipo_cuenta: 'ahorros' | 'corriente' | null;
    propietario: string;
    id_empleado: number | null;
    exento_4x1000: boolean;
    activa: boolean;
    created_at: Date;
}
