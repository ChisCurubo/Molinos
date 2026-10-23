export interface EditarGastoDirectoData {
    concepto?: string;
    monto?: number;
    fecha?: string;
    metodo_pago?: string;
    comprobante_url?: string;
    observaciones?: string;
}

export interface IGastoDirectoRepository {
    crear(data: { concepto: string; monto: number; fecha: string; metodo_pago?: string; comprobante_url: string; observaciones?: string }): Promise<{ id_cuenta_pagar: number; id_abono: number }>;
    listar(filtros: { desde?: string; hasta?: string }): Promise<any[]>;
    obtenerPorId(id: number): Promise<any | null>;
    editar(id: number, cambios: EditarGastoDirectoData): Promise<void>;
    anular(id: number): Promise<boolean>;
}
