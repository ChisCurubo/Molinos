// Objeto APP para la entidad de dominio de negocio

import { EmpleadoApp } from './empleado.app';

export interface PrestamoEmpleadoApp {
    id: number;
    empleado?: EmpleadoApp;
    fecha: Date;
    concepto: string;
    valor: number;
    cuotas: number;
    created_at: Date;
}
