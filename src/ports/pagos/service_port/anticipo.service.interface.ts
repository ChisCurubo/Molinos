export interface IAnticipoService {
    crearAnticipoTx(data: any): Promise<any>;
    listarAnticipos(filtros: { tercero?: string; id?: number; estado?: string }): Promise<any[]>;
    obtenerAnticipoDetalle(id: number): Promise<any>;
    anularAnticipoTx(id: number): Promise<any>;
}
