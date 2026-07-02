// Automáticamente generado a partir de molinos_create_v4.sql

export interface PrestamoFinancieroSQL {
    id: number;
    nombre_prestamo: string;
    fecha_adquisicion: Date;
    monto_principal: number;
    tasa_interes: number;
    saldo_pendiente: number;
    activo: boolean;
    created_at: Date;
}
