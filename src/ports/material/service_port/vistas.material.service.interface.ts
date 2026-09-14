export interface IVistaMaterialService {
    estadoPagoMaterial(estado?: string): Promise<any[]>;
    estadoPagoMaterialById(id_entrada: number): Promise<any | null>;
    estadoPagoFlete(estado?: string): Promise<any[]>;
    estadoPagoFleteById(id_entrada: number): Promise<any | null>;
    excedenteEmpresa(estado_distribucion?: string): Promise<any[]>;
    excedentePorVehiculo(): Promise<any[]>;
    excedentePorVehiculoById(id_vehiculo: number): Promise<any[]>;
    analisisCompleto(id_minero?: number, id_mina?: number, desde?: string, hasta?: string): Promise<any[]>;
    estadoAgua(estado?: string): Promise<any[]>;
}
