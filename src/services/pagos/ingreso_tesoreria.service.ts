import { IIngresoTesoreriaRepository, FiltrosIngresoTesoreria } from '../../ports/pagos/repository_port/ingreso_tesoreria.repository.interface';
import { IIngresoTesoreriaService } from '../../ports/pagos/service_port/ingreso_tesoreria.service.interface';
import { CategoriaIngresoSQL, IngresoTesoreriaSQL } from '../../models/pagos/sql/ingreso_tesoreria.sql';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };

/**
 * Ingresos de tesorería: todo el dinero que entra realmente a la empresa (distinto de
 * Deposito, que es solo caja menor de planta). Un desembolso de Préstamo_Financiero
 * genera el suyo automáticamente (ver PrestamoFinancieroService.create) — este CRUD es
 * para los demás ingresos (aportes de socio, ventas, cobros manuales, etc.).
 */
export class IngresoTesoreriaService implements IIngresoTesoreriaService {
    constructor(private repo: IIngresoTesoreriaRepository) {}

    async registrar(data: { id_categoria: number; concepto: string; valor: number; fecha?: string; comprobante_url?: string }): Promise<IngresoTesoreriaSQL> {
        if (!data.id_categoria) throw err('id_categoria es requerido');
        if (!(Number(data.valor) > 0)) throw err('El valor del ingreso debe ser mayor a 0');
        const concepto = (data.concepto || '').trim();
        if (!concepto) throw err('El concepto es requerido');

        const fecha = data.fecha || new Date().toISOString().slice(0, 10);
        const id = await this.repo.crear({ id_categoria: data.id_categoria, concepto, valor: data.valor, fecha, comprobante_url: data.comprobante_url });
        const creado = await this.repo.obtenerPorId(id);
        return creado!;
    }

    async obtenerPorId(id: number): Promise<IngresoTesoreriaSQL | null> {
        return this.repo.obtenerPorId(id);
    }

    async listar(filtros: FiltrosIngresoTesoreria): Promise<IngresoTesoreriaSQL[]> {
        return this.repo.listar(filtros);
    }

    async actualizar(id: number, data: Partial<IngresoTesoreriaSQL>): Promise<IngresoTesoreriaSQL | null> {
        const existe = await this.repo.obtenerPorId(id);
        if (!existe) throw err('Ingreso no encontrado', 404);
        if (existe.id_prestamo_fin) throw err('Este ingreso viene de un préstamo financiero; edítalo desde ese módulo', 409);
        await this.repo.actualizar(id, data);
        return this.repo.obtenerPorId(id);
    }

    async eliminar(id: number): Promise<boolean> {
        const existe = await this.repo.obtenerPorId(id);
        if (!existe) throw err('Ingreso no encontrado', 404);
        if (existe.id_prestamo_fin) throw err('Este ingreso viene de un préstamo financiero y no se puede eliminar aquí', 409);
        return this.repo.eliminar(id);
    }

    async listarCategorias(): Promise<CategoriaIngresoSQL[]> {
        return this.repo.listarCategorias();
    }
}
