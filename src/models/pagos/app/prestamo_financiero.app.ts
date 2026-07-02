// Objeto APP para la entidad de dominio de negocio

export interface PrestamoFinancieroApp {
    id: number;
    nombre_prestamo: string;
    fecha_adquisicion: Date;
    monto_principal: number;
    tasa_interes: number;
    saldo_pendiente: number;
    activo: boolean;
    created_at: Date;
}
