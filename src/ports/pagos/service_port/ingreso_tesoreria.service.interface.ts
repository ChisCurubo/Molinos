import { CategoriaIngresoSQL, IngresoTesoreriaSQL } from '../../../models/pagos/sql/ingreso_tesoreria.sql';
import { FiltrosIngresoTesoreria } from '../repository_port/ingreso_tesoreria.repository.interface';

export interface IIngresoTesoreriaService {
    registrar(data: { id_categoria: number; concepto: string; valor: number; fecha?: string; comprobante_url?: string }): Promise<IngresoTesoreriaSQL>;
    obtenerPorId(id: number): Promise<IngresoTesoreriaSQL | null>;
    listar(filtros: FiltrosIngresoTesoreria): Promise<IngresoTesoreriaSQL[]>;
    actualizar(id: number, data: Partial<IngresoTesoreriaSQL>): Promise<IngresoTesoreriaSQL | null>;
    eliminar(id: number): Promise<boolean>;
    listarCategorias(): Promise<CategoriaIngresoSQL[]>;
}
