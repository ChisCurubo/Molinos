import { PoolConnection } from 'mysql2/promise';

// Datos para registrar un consumo/adelanto de combustible (ACPM).
// El origen es excluyente: id_material_planta_entrada (flete) O id_agua (agua).
export interface CrearCombustibleDTO {
    id_gasolinera?: number | null;
    tipo_consumo?: string;            // por defecto 'vehiculo'
    forma_pago?: string;              // 'efectivo' | 'credito', por defecto 'credito'
    id_dueno_volqueta?: number | null;
    id_vehiculo?: number | null;
    id_planta?: number | null;
    id_material_planta_entrada?: number | null;
    id_agua?: number | null;
    fecha: string;
    descripcion?: string | null;
    valor: number;
    comprobante_url?: string | null;
}

// Fila de combustible con datos de origen (para listados / futura CxP a la gasolinera).
export interface CombustibleRow {
    id: number;
    id_gasolinera: number | null;
    gasolinera: string | null;
    tipo_consumo: string;
    forma_pago: string;
    id_dueno_volqueta: number | null;
    dueno_volqueta: string | null;
    id_vehiculo: number | null;
    placa: string | null;
    id_planta: number | null;
    id_material_planta_entrada: number | null;
    id_agua: number | null;
    fecha: string;
    descripcion: string | null;
    valor: number;
    comprobante_url: string | null;
    created_at: string;
    estado_pago: string;       // pendiente | parcial | pagado (efectivo siempre 'pagado')
    total_pagado: number;
    saldo_pendiente: number;
}

// Flete de una entrada con su ACPM (para la cascada de arrastre por dueño).
export interface FleteConAcpmRow {
    id_entrada: number;
    fecha_llegada: string;
    numero_volqueta: number;
    placa: string | null;
    costo_volqueta: number;   // flete bruto
    acpm: number;             // Σ Combustible de la entrada (tipo vehiculo)
}

// Agregado mensual de combustible (para el resumen y los KPIs).
export interface ResumenMensualCombustibleRow {
    periodo: string;             // 'YYYY-MM'
    cantidad: number;
    total: number;
    total_efectivo: number;      // ya resuelto (adelantos / caja menor)
    total_credito: number;       // pendiente de agrupar a la gasolinera
    total_vehiculo: number;
    total_planta: number;
    total_maquinaria: number;
    total_otro: number;
}

export interface TopGasolineraRow {
    id_gasolinera: number;
    gasolinera: string | null;
    total: number;
    cantidad: number;
}

export interface TopDuenoAdelantoRow {
    id_dueno_volqueta: number;
    dueno_volqueta: string | null;
    total_adelantado: number;
    cantidad: number;
}

export interface ICombustibleRepository {
    // --- Escritura (transaccional) ---
    crear(data: CrearCombustibleDTO, conn?: PoolConnection): Promise<number>;
    actualizarValor(id: number, valor: number, comprobante_url: string | null | undefined, conn?: PoolConnection): Promise<void>;
    eliminarPorEntrada(idEntrada: number, conn?: PoolConnection): Promise<void>;
    eliminarPorAgua(idAgua: number, conn?: PoolConnection): Promise<void>;

    // --- Registro manual (tanqueos de planta/maquinaria/vehículo no atados a un viaje) ---
    actualizar(id: number, data: Partial<CrearCombustibleDTO>): Promise<void>;
    eliminar(id: number): Promise<void>;
    // ¿Ya está agrupado en una Cuenta_Por_Pagar (módulo de pago a la gasolinera)?
    estadoCxpDeCombustible(id: number, conn?: PoolConnection): Promise<{ materializado: boolean; abonado: number }>;

    // --- Sincronización (el ACPM de flete/agua es 1 fila 'vehiculo' por origen) ---
    // Devuelve la fila 'vehiculo' de ACPM de una entrada de material, si existe (para editar/borrar).
    obtenerAcpmDeEntrada(idEntrada: number, conn?: PoolConnection): Promise<CombustibleRow | null>;
    obtenerAcpmDeAgua(idAgua: number, conn?: PoolConnection): Promise<CombustibleRow | null>;

    // --- Agregados para netear el flete ---
    sumaPorEntrada(idEntrada: number, conn?: PoolConnection): Promise<number>;
    sumaPorAgua(idAgua: number, conn?: PoolConnection): Promise<number>;

    // --- Arrastre por dueño (cascada más viejo → más nuevo) ---
    // Fletes del dueño (no cancelados) con su ACPM, ordenados por fecha ASC.
    fletesConAcpmPorDueno(idDueno: number, conn?: PoolConnection): Promise<FleteConAcpmRow[]>;

    // --- Listados (base para la futura CxP a la gasolinera) ---
    listar(filtros: { desde?: string; hasta?: string; id_gasolinera?: number; id_dueno_volqueta?: number; tipo_consumo?: string; forma_pago?: string }): Promise<CombustibleRow[]>;
    obtenerPorId(id: number): Promise<CombustibleRow | null>;

    // --- Reportes / KPIs ---
    resumenMensual(filtros: { anio?: number; forma_pago?: string; tipo_consumo?: string }): Promise<ResumenMensualCombustibleRow[]>;
    topGasolinerasPorValor(limite: number): Promise<TopGasolineraRow[]>;
    topDuenosPorAdelanto(limite: number): Promise<TopDuenoAdelantoRow[]>;
}
