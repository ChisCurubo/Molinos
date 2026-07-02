// Objeto APP para la entidad de dominio de negocio

import { InventarioLoteApp } from './inventario_lote.app';
import { UsuarioApp } from '../../auth/app/usuario.app';

export interface KardexMovimientoApp {
    id: number;
    lote?: InventarioLoteApp;
    fecha: Date;
    tipo_movimiento: string;
    toneladas_movidas: number;
    destino_referencia: string;
    usuario?: UsuarioApp;
    comentarios: string;
}
