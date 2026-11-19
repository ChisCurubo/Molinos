import { PoolConnection } from 'mysql2/promise';
import { ContratoAlquilerSQL } from '../../../models/pagos/sql/contrato_alquiler.sql';
import { AlquilerSQL } from '../../../models/pagos/sql/alquiler.sql';

export interface IContratoAlquilerRepository {
    create(data: Omit<ContratoAlquilerSQL, 'id' | 'created_at' | 'deleted_at'>, conn: PoolConnection): Promise<number>;
    getById(id: number, conn?: PoolConnection): Promise<ContratoAlquilerSQL | null>;
    update(id: number, data: Partial<ContratoAlquilerSQL>): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    list(): Promise<ContratoAlquilerSQL[]>;

    // Generación de los meses (Alquileres hijos del contrato)
    crearAlquilerMensual(data: Omit<AlquilerSQL, 'id' | 'created_at' | 'deleted_at'>, conn: PoolConnection): Promise<number>;
    mesesDeContrato(idContrato: number): Promise<AlquilerSQL[]>;
}
