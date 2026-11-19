import { PoolConnection } from 'mysql2/promise';
import { BonoEmpleadoSQL } from '../../../models/nomina/sql/bono_empleado.sql';

export interface IBonoEmpleadoRepository {
    crear(data: { id_empleado: number; fecha: string; concepto: string; valor: number }, conn: PoolConnection): Promise<number>;
    confirmarConCuentaPagar(id: number, id_cuenta_pagar: number, conn: PoolConnection): Promise<void>;
    obtenerPorId(id: number, conn?: PoolConnection): Promise<BonoEmpleadoSQL | null>;
    listar(filtros: { id_empleado?: number; desde?: string; hasta?: string }): Promise<BonoEmpleadoSQL[]>;
    sumarPorEmpleadoYRango(id_empleado: number, desde: string, hasta: string): Promise<number>;
    eliminar(id: number, conn?: PoolConnection): Promise<boolean>;

    // Enganche CxP (categoría Bono empleado) — beneficiario directo (id_empleado).
    crearCuentaPagar(data: { id_empleado: number; concepto: string; valor_total: number; fecha_creacion: string }, conn: PoolConnection): Promise<number>;
    estadoCuentaPagar(id_cuenta_pagar: number): Promise<{ valor_pagado: number; estado: string } | null>;
    anularCuentaPagar(id_cuenta_pagar: number, conn: PoolConnection): Promise<void>;
}
