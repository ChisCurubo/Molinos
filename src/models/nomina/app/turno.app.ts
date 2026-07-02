// Objeto APP para la entidad de dominio de negocio

import { EmpleadoApp } from './empleado.app';
import { TipoTurnoApp } from './tipo_turno.app';
import { PlantaApp } from '../../material/app/planta.app';

export interface TurnoApp {
    id: number;
    fecha: Date;
    empleado?: EmpleadoApp;
    tipo_turno?: TipoTurnoApp;
    planta?: PlantaApp;
    proceso: string;
    horas_trabajadas: number;
    comentarios: string;
    quincena: number;
    created_at: Date;
}
