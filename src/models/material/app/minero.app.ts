// Objeto APP para la entidad de dominio de negocio

export interface MineroApp {
    id: number;
    nombre: string;
    titular?: string;
    cc?: string;
    alias: string;
    telefono: string;
    ciudad: string;
    banco?: string;
    numero_cuenta?: string;
    nequi: boolean;
    metodo_calculo: string;
    estado: string;
    created_at: Date;
    updated_at: Date;
}
