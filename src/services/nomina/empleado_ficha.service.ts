import { IEmpleadoRepository, PrestamoEmpleadoRepositoryInterface } from '../../ports/nomina/repository_port/empleado.repository.interface';
import { IEmpleadoSalarioRepository } from '../../ports/nomina/repository_port/empleado_salario.repository.interface';
import { IBonoEmpleadoRepository } from '../../ports/nomina/repository_port/bono_empleado.repository.interface';
import { INominaLiquidacionService } from '../../ports/nomina/service_port/nomina_liquidacion.service.interface';

const err = (msg: string, status = 400): Error => { const e: any = new Error(msg); e.status = status; return e; };

/**
 * Ficha 360 del empleado: agrega, sin tabla nueva, todo lo que ya existe en los módulos
 * de nómina — datos personales (incluye cc), salario vigente, historial de liquidaciones,
 * bonos, préstamos activos con saldo, y prestaciones estimadas del año. Solo lectura.
 * NOMINA_QUINCENAL_plan.md Fase 5.
 */
export class EmpleadoFichaService {
    constructor(
        private empleadoRepo: IEmpleadoRepository,
        private salarioRepo: IEmpleadoSalarioRepository,
        private prestamoRepo: PrestamoEmpleadoRepositoryInterface,
        private bonoRepo: IBonoEmpleadoRepository,
        private liquidacionService: INominaLiquidacionService
    ) {}

    async obtenerFicha(id_empleado: number, anioPrestaciones?: number): Promise<any> {
        const empleado = await this.empleadoRepo.getById(id_empleado);
        if (!empleado) throw err('El empleado no existe', 404);

        const [salario_vigente, liquidaciones, bonos, prestamos] = await Promise.all([
            this.salarioRepo.obtenerVigente(id_empleado),
            this.liquidacionService.listar({ id_empleado }),
            this.bonoRepo.listar({ id_empleado }),
            this.prestamoRepo.listAll({ id_empleado })
        ]);

        const prestamos_con_saldo = await Promise.all(prestamos.map(async p => {
            const cxc = await this.prestamoRepo.cxcDePrestamo(p.id);
            return {
                ...p,
                saldo_pendiente: cxc ? Number(cxc.saldo) : Number(p.valor),
                estado_cobro: cxc ? cxc.estado : 'sin_registrar'
            };
        }));
        const prestamos_activos = prestamos_con_saldo.filter(p => p.saldo_pendiente > 0 && p.estado_cobro !== 'anulado');

        const anio = anioPrestaciones || new Date().getFullYear();
        let prestaciones_estimadas = null;
        if (salario_vigente) {
            prestaciones_estimadas = await this.liquidacionService.calcularPrestaciones(id_empleado, anio);
        }

        return {
            empleado,
            salario_vigente,
            liquidaciones,
            bonos,
            prestamos_activos,
            prestaciones_estimadas
        };
    }
}
