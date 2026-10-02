import { Request, Response } from 'express';
import { IEmpleadoSalarioService } from '../../ports/nomina/service_port/empleado_salario.service.interface';

export class EmpleadoSalarioController {
    constructor(private service: IEmpleadoSalarioService) {}

    private fail(res: Response, error: any) {
        res.status(error?.status || 400).json({ success: false, message: error.message });
    }

    // POST /nomina/empleados/:id/salario  { tipo_pago, tarifa_monto, aplica_aux_transp?, fecha_inicio? }
    crear = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.crearNuevaVigencia(Number(req.params.id), req.body);
            res.status(201).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // GET /nomina/empleados/:id/salario
    obtenerVigente = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.obtenerVigente(Number(req.params.id));
            if (!data) { res.status(404).json({ success: false, message: 'El empleado no tiene salario configurado' }); return; }
            res.status(200).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // GET /nomina/empleados/:id/salario/historial
    historial = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.listarPorEmpleado(Number(req.params.id));
            res.status(200).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // PUT|PATCH /nomina/empleados/salario/:idSalario
    actualizar = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.service.actualizar(Number(req.params.idSalario), req.body);
            res.status(200).json({ success: true, data });
        } catch (e: any) { this.fail(res, e); }
    };

    // DELETE /nomina/empleados/salario/:idSalario
    eliminar = async (req: Request, res: Response): Promise<void> => {
        try {
            const deleted = await this.service.eliminar(Number(req.params.idSalario));
            if (!deleted) { res.status(404).json({ success: false, message: 'Configuración salarial no encontrada' }); return; }
            res.status(200).json({ success: true, message: 'Configuración salarial eliminada' });
        } catch (e: any) { this.fail(res, e); }
    };
}
