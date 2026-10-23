import { IGastoDirectoRepository } from '../../ports/pagos/repository_port/gasto_directo.repository.interface';
import { IGastoDirectoService } from '../../ports/pagos/service_port/gasto_directo.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };
const r2 = (n: number) => Math.round(n * 100) / 100;

export class GastoDirectoService implements IGastoDirectoService {
    constructor(private repo: IGastoDirectoRepository) {}

    async registrar(data: any): Promise<any> {
        const concepto = (data.concepto || '').trim();
        if (!concepto) throw err('El concepto es obligatorio');
        const monto = r2(Number(data.monto));
        if (!(monto > 0)) throw err('El monto debe ser mayor a 0');
        if (!data.comprobante_url) throw err('comprobante_url es obligatorio');

        const { id_cuenta_pagar } = await this.repo.crear({
            concepto, monto,
            fecha: data.fecha || new Date().toISOString().slice(0, 10),
            metodo_pago: data.metodo_pago,
            comprobante_url: data.comprobante_url,
            observaciones: data.observaciones
        });
        return this.repo.obtenerPorId(id_cuenta_pagar);
    }

    async listar(filtros: { desde?: string; hasta?: string }): Promise<any[]> {
        return this.repo.listar(filtros);
    }

    async obtenerPorId(id: number): Promise<any> {
        const row = await this.repo.obtenerPorId(id);
        if (!row) throw err('Gasto directo no encontrado', 404);
        return row;
    }

    async editar(id: number, data: any): Promise<any> {
        const actual = await this.repo.obtenerPorId(id);
        if (!actual) throw err('Gasto directo no encontrado', 404);
        if (actual.estado === 'anulado') throw err('No se puede editar un gasto anulado', 409);

        const cambios: any = {};
        if (data.concepto !== undefined) {
            const concepto = (data.concepto || '').trim();
            if (!concepto) throw err('El concepto no puede quedar vacío');
            cambios.concepto = concepto;
        }
        if (data.monto !== undefined) {
            const monto = r2(Number(data.monto));
            if (!(monto > 0)) throw err('El monto debe ser mayor a 0');
            cambios.monto = monto;
        }
        if (data.fecha !== undefined) cambios.fecha = data.fecha;
        if (data.metodo_pago !== undefined) cambios.metodo_pago = data.metodo_pago;
        if (data.comprobante_url !== undefined) {
            if (!data.comprobante_url) throw err('comprobante_url no puede quedar vacío');
            cambios.comprobante_url = data.comprobante_url;
        }
        if (data.observaciones !== undefined) cambios.observaciones = data.observaciones;

        if (Object.keys(cambios).length === 0) throw err('No hay cambios para aplicar');

        await this.repo.editar(id, cambios);
        return this.repo.obtenerPorId(id);
    }

    async anular(id: number): Promise<void> {
        const ok = await this.repo.anular(id);
        if (!ok) throw err('Gasto directo no encontrado o ya anulado', 404);
    }
}
