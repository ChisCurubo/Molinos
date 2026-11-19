export interface ImpuestoSQL {
    id: number;
    nombre: string;
    tasa: number;
    aplica_a: 'egreso' | 'ingreso';
    activo: boolean;
}

export interface ImpuestoAplicadoSQL {
    id: number;
    id_impuesto: number;
    id_abono_cxp: number;
    id_cuenta_bancaria: number;
    valor_base: number;
    valor_impuesto: number;
    fecha: Date;
    created_at: Date;
}
