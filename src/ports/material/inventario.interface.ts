export interface IInventarioRepository {
    obtenerMaterialCrudo(): Promise<any[]>;
    obtenerConcentrado(): Promise<any[]>;
    obtenerResumenLote(idLote: number): Promise<any>;
}
