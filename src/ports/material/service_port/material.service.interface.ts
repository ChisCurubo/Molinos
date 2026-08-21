import { MaterialPlantaEntradaSQL, CreateMaterialEntradaDTO, AsignarPrecioManualDTO, ActualizarGastosOperativosDTO, EntradaMaterial } from '../../../models/material/sql/material_planta_entrada.sql';
import { CreateAnalisisDTO } from '../../../models/material/sql/analisis.sql';
import { TipoMaterialSQL } from '../../../models/material/sql/tipo_material.sql';
import { PrecioMaterialSQL, PrecioMaterialLookup } from '../../../models/material/sql/precio_material.sql';
import { TarifaCalculoSQL } from '../../../models/material/sql/tarifa_calculo.sql';
import { ProveedorSQL } from '../../../models/pagos/sql/proveedor.sql';
import { MinaSQL } from '../../../models/material/sql/mina.sql';

export interface IMaterialEntradaService {
    registrarLlegada(data: CreateMaterialEntradaDTO): Promise<number>;
    vincularAnalisis(analisisData: CreateAnalisisDTO): Promise<void>;
    obtenerEntrada(id: number): Promise<any>;
    listarEntradas(fechaDesde: string, fechaHasta: string, estado: string, limit: number, offset: number): Promise<any[]>;
    listarPendientesLaboratorio(): Promise<any[]>;
    listarPorMinero(idMinero: number): Promise<any[]>;
    listarPorMina(idMina: number): Promise<any[]>;
    listarPorVehiculo(idVehiculo: number): Promise<any[]>;
    listarPorDueno(idDueno: number): Promise<any[]>;
    listarPorFecha(fecha: string): Promise<any[]>;
    actualizarEstado(id: number, estado: string): Promise<void>;
    cancelar(id: number, motivo: string): Promise<void>;
    estadisticas(): Promise<any>;
    actualizarEntrada(id: number, data: CreateMaterialEntradaDTO): Promise<any>;
    asignarPrecio(id: number, data: AsignarPrecioManualDTO): Promise<EntradaMaterial>;
    obtenerGastosOperativos(id: number): Promise<any>;
    actualizarGastosOperativos(id: number, data: ActualizarGastosOperativosDTO): Promise<EntradaMaterial>;
    eliminarEntrada(id: number): Promise<void>;
}

export interface IPrecioMaterialService {
    create(data: any): Promise<PrecioMaterialSQL>;
    getById(id: number): Promise<PrecioMaterialSQL | null>;
    update(id: number, data: any): Promise<PrecioMaterialSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<PrecioMaterialSQL[]>;
    buscarPrecio(idMinero: number | null, idZona: number | null, metodo: string, tenorFalso: number, fechaEntrada: string | Date, conn?: any): Promise<PrecioMaterialLookup | null>;
    buscarTarifaZona(idZona: number | null, conn?: any): Promise<number>;
    insertarLote(data: any): Promise<void>;
    reemplazarIntervalo(id: number, data: any): Promise<number>;
    listarPrecios(filtros?: { id_minero?: number | null; id_zona?: number | null; alcance?: string; activo?: boolean }): Promise<any[]>;
}

export interface ITipoMaterialService {
    create(data: any): Promise<TipoMaterialSQL>;
    getById(id: number): Promise<TipoMaterialSQL | null>;
    update(id: number, data: any): Promise<TipoMaterialSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TipoMaterialSQL[]>;
}

export interface ITarifaCalculoService {
    create(data: any): Promise<TarifaCalculoSQL>;
    getById(id: number): Promise<TarifaCalculoSQL | null>;
    update(id: number, data: any): Promise<TarifaCalculoSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<TarifaCalculoSQL[]>;
}

export interface IProveedorService {
    create(data: any): Promise<ProveedorSQL>;
    getById(id: number): Promise<ProveedorSQL | null>;
    update(id: number, data: any): Promise<ProveedorSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ProveedorSQL[]>;
}

export interface IMinaService {
    create(data: any): Promise<MinaSQL>;
    getById(id: number): Promise<MinaSQL | null>;
    update(id: number, data: any): Promise<MinaSQL | null>;
    delete(id: number): Promise<boolean>;
    list(): Promise<MinaSQL[]>;
}