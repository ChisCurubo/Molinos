export interface IGastoDirectoService {
    registrar(data: any): Promise<any>;
    listar(filtros: { desde?: string; hasta?: string }): Promise<any[]>;
    obtenerPorId(id: number): Promise<any>;
    editar(id: number, data: any): Promise<any>;
    anular(id: number): Promise<void>;
}
