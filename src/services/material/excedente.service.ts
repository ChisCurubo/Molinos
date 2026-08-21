import { Pool } from 'mysql2/promise';
import { ExcedenteSQL, UpsertExcedenteDTO } from '../../models/material/sql/excedente.sql';
import { IExcedenteRepository, IExcedenteService } from '../../ports/material/excedente.interface';
import { IMaterialEntradaRepository } from '../../ports/material/repository_port/material.repository.interface';
import { EstadoEntrada } from '../../models/material/sql/material_planta_entrada.sql';
import { HttpError } from '../../helpers/http_error';

export class ExcedenteService implements IExcedenteService {
    constructor(
        private excedenteRepo: IExcedenteRepository,
        private materialRepo: IMaterialEntradaRepository,
        private db: Pool
    ) {}

    async obtenerDeEntrada(idEntrada: number): Promise<ExcedenteSQL | null> {
        const entrada = await this.materialRepo.obtenerPorId(idEntrada);
        if (!entrada) throw new HttpError(404, 'Entrada de material no encontrada');
        return this.excedenteRepo.obtenerPorEntrada(idEntrada);
    }

    // Upsert 1:1: crea/actualiza el excedente de la entrada, o lo ELIMINA si el valor es 0
    // (no se deja excedente en 0). Devuelve el excedente resultante, o null si se eliminó.
    // El monto se puede enviar como valor_excedente (directo) o tarifa_excedente_por_ton
    // (cobro por ton seca → valor = total_material_seco × tarifa).
    async registrarOActualizar(idEntrada: number, data: UpsertExcedenteDTO): Promise<ExcedenteSQL | null> {
        const conn = await this.db.getConnection();
        await conn.beginTransaction();
        try {
            const entrada = await this.materialRepo.obtenerPorId(idEntrada, conn);
            if (!entrada) throw new HttpError(404, 'Entrada de material no encontrada');
            if (entrada.estado === EstadoEntrada.CANCELADA) {
                throw new HttpError(409, 'No se puede registrar excedente en una entrada cancelada.', 'ENTRADA_CANCELADA');
            }

            // Resolver el monto: por tarifa (× ton secas) o valor directo.
            let valor: number;
            if (data.tarifa_excedente_por_ton !== undefined && data.tarifa_excedente_por_ton !== null) {
                const tarifa = Number(data.tarifa_excedente_por_ton);
                if (!Number.isFinite(tarifa) || tarifa < 0) {
                    throw new HttpError(400, 'tarifa_excedente_por_ton debe ser un número mayor o igual a 0.', 'EXCEDENTE_INVALIDO');
                }
                const tonSecas = Number(entrada.total_material_seco);
                if (!Number.isFinite(tonSecas) || tonSecas <= 0) {
                    throw new HttpError(409, 'La entrada no tiene toneladas secas (análisis pendiente); no se puede calcular el excedente por tarifa.', 'SIN_TON_SECAS');
                }
                valor = tonSecas * tarifa;
            } else {
                valor = Number(data.valor_excedente);
                if (!Number.isFinite(valor) || valor < 0) {
                    throw new HttpError(400, 'valor_excedente debe ser un número mayor o igual a 0.', 'EXCEDENTE_INVALIDO');
                }
            }

            const existente = await this.excedenteRepo.obtenerPorEntrada(idEntrada, conn);
            // Si ya se distribuyó (total o parcial), no se permite reeditar ni eliminar.
            if (existente && Number(existente.monto_distribuido) > 0) {
                throw new HttpError(409, 'El excedente ya tiene distribución registrada; no se puede editar su valor.', 'EXCEDENTE_DISTRIBUIDO');
            }

            let resultado: ExcedenteSQL | null;
            if (valor > 0) {
                if (existente) {
                    await this.excedenteRepo.actualizar(existente.id, { ...data, valor_excedente: valor }, conn);
                } else {
                    await this.excedenteRepo.insertar(idEntrada, { ...data, valor_excedente: valor }, conn);
                }
            } else {
                // valor 0 → no hay excedente: se elimina la fila si existía.
                if (existente) await this.excedenteRepo.eliminar(existente.id, conn);
            }

            // Sincroniza la entrada: excedente_calculado = valor y recalcula total_material
            // (= precio_total + total_costos_operativos + excedente).
            const precioTotal = Number(entrada.precio_total) || 0;
            const gastos = Number(entrada.total_costos_operativos) || 0;
            const totalMaterial = precioTotal + gastos + valor;
            await this.materialRepo.actualizarExcedente(idEntrada, valor, totalMaterial, conn);

            await conn.commit();
            resultado = valor > 0 ? await this.excedenteRepo.obtenerPorEntrada(idEntrada) : null;
            return resultado;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}
