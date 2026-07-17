import { Request, Response } from 'express';
import { CacheService } from '../../services/cache/cache.service';
import { InfoRepository } from '../../repositories/info/info.repository';
const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const err = (res: Response, e: any, status = 500) => res.status(status).json({ success: false, error: e.message || String(e) });

import { CONFIG } from '../../config/config';

// Mapa estático de la API
export const API_MAP = {
    version: '1.0.0',
    nombre: 'Molinos ERP v4 API',
    descripcion: 'API del sistema ERP para empresa minera Molinos de Colombia',
    documentacion: `http://localhost:${CONFIG.serverPort}/api-docs`,
    modulos: [
        {
            nombre: 'auth', prefijo: '/api/v1/auth',
            endpoints: [
                { grupo: 'Sesión',      metodo: 'POST', ruta: '/login',           descripcion: 'Autenticar usuario', body: { username: 'david', password: '123' }, response: { token: '<jwt>', usuario: {} } },
                { grupo: 'Sesión',      metodo: 'GET',  ruta: '/verify',          descripcion: 'Verificar token JWT activo', headers: { Authorization: 'Bearer <token>' } },
                { grupo: 'Contraseña',  metodo: 'POST', ruta: '/forgot-password', descripcion: 'Generar contraseña temporal (DEV: retorna en body)', body: { username: 'david' } },
                { grupo: 'Contraseña',  metodo: 'POST', ruta: '/reset-password',  descripcion: 'Cambiar contraseña usando la temporal', body: { username: 'david', tempPassword: '<temp>', nuevaPassword: 'nueva123' } },
                { grupo: 'Usuarios',    metodo: 'GET',  ruta: '/usuarios',        descripcion: 'Listar todos los usuarios', requiere_token: true },
                { grupo: 'Usuarios',    metodo: 'POST', ruta: '/usuarios',        descripcion: 'Crear usuario', requiere_token: true, body: { username: 'nuevo_usuario', password: 'pass', id_rol: 1 } },
                { grupo: 'Usuarios',    metodo: 'GET',  ruta: '/usuarios/:id',    descripcion: 'Detalle de un usuario', requiere_token: true },
                { grupo: 'Usuarios',    metodo: 'PUT',  ruta: '/usuarios/:id',    descripcion: 'Actualizar usuario', requiere_token: true },
                { grupo: 'Usuarios',    metodo: 'DELETE', ruta: '/usuarios/:id',  descripcion: 'Eliminar usuario', requiere_token: true },
            ]
        },
        {
            nombre: 'material', prefijo: '/api/v1/material', requiere_token: true,
            endpoints: [
                // Entradas MPE
                { grupo: 'Entradas MPE', metodo: 'POST',  ruta: '/entrada',                        descripcion: 'FASE 1: Registrar llegada de volqueta', body: { numero_volqueta: 100, id_mina: 1, id_vehiculo: 1, id_tipo_material: 1, fecha_llegada: '2026-07-01', peso_llegada_planta: 12000.5 } },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas',                        descripcion: 'Listar entradas', params: { desde: '2026-01-01', hasta: '2026-12-31', estado: '', id_mina: '', id_minero: '', limit: 50, offset: 0 } },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/:id',                    descripcion: 'Detalle completo de una entrada' },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/minero/:id_minero',      descripcion: 'Entradas de un minero' },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/mina/:id_mina',          descripcion: 'Entradas de una mina' },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/vehiculo/:id_vehiculo',  descripcion: 'Entradas de un vehículo' },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/dueno/:id_dueno',        descripcion: 'Entradas del dueño de volqueta' },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/fecha/:fecha',           descripcion: 'Entradas de una fecha exacta (YYYY-MM-DD)' },
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/pendientes-analisis',    descripcion: 'Entradas sin humedad/tenor' },
                { grupo: 'Entradas MPE', metodo: 'PATCH', ruta: '/entradas/:id/estado',             descripcion: 'Cambiar estado', body: { estado: 'pagada' } },
                { grupo: 'Entradas MPE', metodo: 'PATCH', ruta: '/entradas/:id/cancelar',           descripcion: 'Cancelar entrada', body: { motivo: 'Error de registro' } },
                // Análisis
                { grupo: 'Análisis', metodo: 'POST',  ruta: '/analisis',                                descripcion: 'FASES 2-5: Registrar análisis y recalcular', body: { id_entrada: 1, id_tipo_analisis: 1, numero_analisis: 'AN-002', toneladas: 10.2, porcentaje_humedad: 15.0, au_concentrado: 14.0, ag_concentrado: 12.0, au_falso: 15.5 } },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/:id',                            descripcion: 'Análisis por ID propio' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/entrada/:id_entrada',            descripcion: 'Todos los análisis de una entrada' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/entrada/:id_entrada/cabeza',     descripcion: 'Solo el análisis Cabeza' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/minero/:id_minero',              descripcion: 'Análisis históricos de un minero' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/mina/:id_mina',                  descripcion: 'Análisis históricos de una mina' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/fecha/:fecha',                   descripcion: 'Análisis por fecha de la entrada' },
                { grupo: 'Análisis', metodo: 'PUT',   ruta: '/analisis/:id',                            descripcion: 'Corregir análisis (recalcula MPE)', body: { id_entrada: 180, porcentaje_humedad: 20.0, au_falso: 18.0, au_concentrado: 20.0, ag_concentrado: 15.0 } },
                { grupo: 'Análisis', metodo: 'PATCH', ruta: '/analisis/:id/pago',                       descripcion: 'Marcar análisis como pagado', body: { estado: 'pagado' } },
                // Volqueta
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta',                         descripcion: 'Lista de vehículos con dueño' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/:id',                     descripcion: 'Detalle de vehículo' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/dueno/:id_dueno',         descripcion: 'Vehículos de un dueño' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/:id/entradas',            descripcion: 'Historial de entradas del vehículo' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/:id/entradas/pendientes', descripcion: 'Entradas con flete pendiente' },
                { grupo: 'Volqueta', metodo: 'POST', ruta: '/volqueta',                        descripcion: 'Crear volqueta' },
                { grupo: 'Volqueta', metodo: 'PUT', ruta: '/volqueta/:id',                     descripcion: 'Actualizar volqueta' },
                { grupo: 'Volqueta', metodo: 'DELETE', ruta: '/volqueta/:id',                  descripcion: 'Eliminar volqueta' },
                // Mina, Mineros y Zonas
                { grupo: 'Mina', metodo: 'POST', ruta: '/mina/minero',      descripcion: 'Registrar un minero', body: { nombre: 'Juan Perez', alias: 'Juancho', metodo_calculo: 'por_gramo', estado: 'activo' } },
                { grupo: 'Mina', metodo: 'POST', ruta: '/mina/zona',        descripcion: 'Registrar una zona', body: { nombre: 'Zona Norte' } },
                { grupo: 'Mina', metodo: 'POST', ruta: '/mina',             descripcion: 'Registrar una mina', body: { nombre: 'Mina El Tesoro', id_minero: 1, id_zona: 1, municipio: 'Zaragoza', estado: 'activa' } },
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina',             descripcion: 'Todas las minas' },
                // Agua Planta
                { grupo: 'Agua', metodo: 'POST', ruta: '/agua',             descripcion: 'Registrar viaje de agua', body: { id_vehiculo: 1, fecha: '2026-07-03', valor_viaje: 50000, cantidad_viajes: 1, acpm: 0, comprobante_url: 'https://ejemplo.com/recibo.png' } },
                { grupo: 'Agua', metodo: 'PUT',  ruta: '/agua/:id',         descripcion: 'Actualizar viaje de agua', body: { valor_viaje: 60000, cantidad_viajes: 2, acpm: 10000, comprobante_url: 'https://ejemplo.com/nuevo_recibo.png' } },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/viajes',      descripcion: 'Listar viajes de agua', params: { desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD' } },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/resumen',     descripcion: 'Resumen por dueño', params: { desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD' } },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/dueno/:id_dueno', descripcion: 'Resumen total y lista de viajes de un dueño específico' },
                // Precios
                { grupo: 'Precios', metodo: 'POST', ruta: '/precios/lote',  descripcion: 'Registrar tarifas por lotes (intervalos)', body: { id_minero: 1, metodo: 'por_gramo', fecha_inicio: '2026-07-03', intervalos: [{ min: 0, max: 10, precio_por_gramo: 150000, precio_por_tonelada: 0 }] } },
                // Vistas
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/estado-pago-material',               descripcion: 'Estado de pago al minero', params: { estado: 'pendiente|parcial|pagado' } },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/estado-pago-material/:id_entrada',   descripcion: 'Estado de pago de una entrada específica' },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/estado-pago-flete',                  descripcion: 'Estado de pago del flete', params: { estado: 'pendiente|parcial|pagado' } },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/estado-pago-flete/:id_entrada',      descripcion: 'Estado flete de una entrada' },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/excedente-empresa',                  descripcion: 'Excedente por entrada', params: { estado_distribucion: 'pendiente|parcial|distribuido' } },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/excedente-por-vehiculo',             descripcion: 'Excedente agrupado por vehículo' },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/excedente-por-vehiculo/:id_vehiculo', descripcion: 'Excedente de un vehículo' },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/analisis-completo',                  descripcion: 'Análisis con referencias resueltas', params: { id_minero: '', id_mina: '', desde: '', hasta: '' } },
                { grupo: 'Vistas', metodo: 'GET', ruta: '/vistas/estado-agua',                        descripcion: 'Estado de pago agua', params: { estado: 'pendiente|pagado' } },
            ]
        },
        {
            nombre: 'pagos', prefijo: '/api/v1/pagos', requiere_token: true,
            endpoints: [
                { grupo: 'Deuda Material', metodo: 'GET', ruta: '/deuda/material',            descripcion: 'Deuda total con mineros' },
                { grupo: 'Deuda Material', metodo: 'GET', ruta: '/deuda/material/minero/:id', descripcion: 'Deuda con un minero específico' },
                { grupo: 'Deuda Flete',    metodo: 'GET', ruta: '/deuda/flete',               descripcion: 'Deuda total de fletes' },
                { grupo: 'Deuda Flete',    metodo: 'GET', ruta: '/deuda/flete/dueno/:id',     descripcion: 'Deuda de flete con un dueño' },
                { grupo: 'Dashboard',      metodo: 'GET', ruta: '/deuda/resumen-general',     descripcion: 'Dashboard: todos los totales pendientes' },
                { grupo: 'Vistas Pagos',   metodo: 'GET', ruta: '/vistas/estado-alquileres',  descripcion: 'Estado de alquileres', params: { estado: 'pendiente|parcial|pagado' } },
                { grupo: 'Vistas Pagos',   metodo: 'GET', ruta: '/vistas/estado-combustible', descripcion: 'Estado de combustible' },
                { grupo: 'Vistas Pagos',   metodo: 'GET', ruta: '/vistas/estado-mulas',       descripcion: 'Estado de mulas (Barranquilla)' },
                { grupo: 'Vistas Pagos',   metodo: 'GET', ruta: '/vistas/saldos-a-favor',     descripcion: 'Saldos disponibles por sobrepago' },
                { grupo: 'Préstamos Financieros', metodo: 'GET', ruta: '/prestamos-financieros', descripcion: 'Listar préstamos financieros' },
                { grupo: 'Préstamos Financieros', metodo: 'GET', ruta: '/prestamos-financieros/:id', descripcion: 'Ver préstamo financiero' },
                { grupo: 'Préstamos Financieros', metodo: 'POST', ruta: '/prestamos-financieros', descripcion: 'Crear préstamo financiero' },
                { grupo: 'Préstamos Financieros', metodo: 'PUT', ruta: '/prestamos-financieros/:id', descripcion: 'Actualizar préstamo financiero' },
            ]
        },
        {
            nombre: 'nomina', prefijo: '/api/v1/nomina', requiere_token: true,
            endpoints: [
                { grupo: 'Empleados', metodo: 'GET', ruta: '/empleados',         descripcion: 'Lista de empleados' },
                { grupo: 'Empleados', metodo: 'GET', ruta: '/empleados/:id',     descripcion: 'Detalle de empleado' },
                { grupo: 'Empleados', metodo: 'POST', ruta: '/empleados',        descripcion: 'Crear empleado' },
                { grupo: 'Empleados', metodo: 'PUT', ruta: '/empleados/:id',     descripcion: 'Actualizar empleado' },
                { grupo: 'Empleados', metodo: 'DELETE', ruta: '/empleados/:id',  descripcion: 'Eliminar empleado' },
                { grupo: 'Plantas',   metodo: 'GET', ruta: '/plantas',           descripcion: 'Lista de plantas' },
                { grupo: 'Plantas',   metodo: 'POST', ruta: '/plantas',          descripcion: 'Crear planta' },
                { grupo: 'Plantas',   metodo: 'PUT', ruta: '/plantas/:id',       descripcion: 'Actualizar planta' },
                { grupo: 'Plantas',   metodo: 'DELETE', ruta: '/plantas/:id',    descripcion: 'Eliminar planta' },
                { grupo: 'Turnos',    metodo: 'GET', ruta: '/turnos',            descripcion: 'Turnos/asistencias', params: { desde: '', hasta: '', id_empleado: '', mes: '', anio: '', quincena: '' } },
                { grupo: 'Turnos',    metodo: 'POST', ruta: '/turnos',           descripcion: 'Crear turno' },
                { grupo: 'Turnos',    metodo: 'PUT', ruta: '/turnos/:id',        descripcion: 'Actualizar turno' },
                { grupo: 'Turnos',    metodo: 'DELETE', ruta: '/turnos/:id',     descripcion: 'Eliminar turno' },
                { grupo: 'Préstamos', metodo: 'POST', ruta: '/empleados/prestamos', descripcion: 'Crear préstamo a empleado' },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/empleados/prestamos/:idEmpleado', descripcion: 'Ver préstamos del empleado' },
                { grupo: 'Préstamos', metodo: 'PUT', ruta: '/empleados/prestamos/:id', descripcion: 'Actualizar préstamo del empleado' },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/vistas/saldo-prestamos-empleado',      descripcion: 'Saldo de préstamos de todos los empleados' },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/vistas/saldo-prestamos-empleado/:id',  descripcion: 'Saldo de préstamos de un empleado' },
            ]
        },
        {
            nombre: 'info', prefijo: '/api/v1/info', requiere_token: true,
            endpoints: [
                { grupo: 'General', metodo: 'GET', ruta: '/',             descripcion: 'Mapa completo de la API (este endpoint)' },
                { grupo: 'General', metodo: 'GET', ruta: '/estadisticas', descripcion: 'Conteo de registros de las tablas principales' },
                { grupo: 'General', metodo: 'GET', ruta: '/health',       descripcion: 'Estado del servidor y conexión a BD' },
            ]
        },
        {
            nombre: 'flujo_completo', prefijo: '/api/v1', requiere_token: true,
            endpoints: [
                { grupo: '1. Recepción', metodo: 'POST',  ruta: '/material/entrada', descripcion: '1. Insertar nuevo material', body: { numero_volqueta: 100, id_mina: 1, id_vehiculo: 1, id_tipo_material: 1, fecha_llegada: '2026-07-02', peso_llegada_planta: 15000.5 } },
                { grupo: '1. Recepción', metodo: 'GET',   ruta: '/material/entradas/:id', descripcion: '2. Ver material recién ingresado' },
                { grupo: '1. Recepción', metodo: 'GET',   ruta: '/material/entradas', descripcion: '3. Ver inventario general (todas las entradas)', params: { limit: 10, offset: 0 } },
                { grupo: '2. Análisis',  metodo: 'POST',  ruta: '/material/analisis', descripcion: '4. Insertar análisis (relacionarlo a la entrada)', body: { id_entrada: 1, id_tipo_analisis: 1, numero_analisis: 'AN-001', toneladas: 15.0, porcentaje_humedad: 12.0, au_concentrado: 20.0, ag_concentrado: 15.0, au_falso: 18.0 } },
                { grupo: '2. Análisis',  metodo: 'PATCH', ruta: '/material/entradas/:id/estado', descripcion: '5. Actualizar estado del material (ej. procesada)', body: { estado: 'procesada' } },
                { grupo: '3. Procesamiento', metodo: 'POST',  ruta: '/material/concentrado', descripcion: '6. Iniciar un lote de concentrado (materia prima procesada)', body: { codigo: 'LOTE-001', fecha_inicio: '2026-07-04' } },
                { grupo: '3. Procesamiento', metodo: 'POST',  ruta: '/material/concentrado/:id/procesar', descripcion: '7. Agregar material (entrada) al molino para este lote', body: { id_entrada: 1, toneladas_aportadas: 10, toneladas_seco_aportadas: 8.5 } },
                { grupo: '3. Procesamiento', metodo: 'PUT',   ruta: '/material/concentrado/:id/cerrar', descripcion: '8. Cerrar lote y enviarlo a canoa (calcula maquila)', body: { toneladas_humedo: 5, porcentaje_humedad: 0.1, fecha_fin: '2026-07-05', hizo_molienda: 1, hizo_filtroprensa: 1 } },
                { grupo: '4. Viajes/Despachos', metodo: 'POST',  ruta: '/material/viajes', descripcion: '9. Crear cabecera de viaje', body: { numero_viaje: '13-1', fecha: '2026-02-10', comentarios: 'Viaje 13-1' } },
                { grupo: '4. Viajes/Despachos', metodo: 'POST',  ruta: '/material/viajes/:id/lineas', descripcion: '10. Asignar lote de concentrado al viaje', body: { id_material_concentrado: 1, total_concentrado_humedo: 25.85, concentrado_seco: 22.48, porcentaje_humedad: 0.13, peso_humedad: 3.36, es_remanente: 0, id_viaje_origen: null, concepto: 'Lote K' } },
                { grupo: '5. Servicios', metodo: 'POST',  ruta: '/material/agua', descripcion: '11. Insertar viaje de agua', body: { id_vehiculo: 1, fecha: '2026-07-03', valor_viaje: 60000, cantidad_viajes: 1, acpm: 0, comprobante_url: 'https://ejemplo.com/recibo.png' } },
                { grupo: '6. Finanzas',  metodo: 'GET',   ruta: '/pagos/deuda/material/minero/:id', descripcion: '12. Ver cuánto debo al minero' },
                { grupo: '6. Finanzas',  metodo: 'GET',   ruta: '/pagos/deuda/flete/dueno/:id', descripcion: '13. Ver cuánto debo de flete (bus/volqueta)' },
                { grupo: '6. Finanzas',  metodo: 'GET',   ruta: '/material/vistas/excedente-empresa', descripcion: '14. Ver excedente y costo de procesar el material' }
            ]
        }
    ]
};

export class InfoController {
    constructor(private repo: InfoRepository) {}

    public apiMap = (_req: Request, res: Response): void => {
        ok(res, API_MAP);
    };

    public estadisticas = async (_req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.repo.estadisticas());
        } catch (e) { err(res, e); }
    };

    public health = async (_req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.repo.health());
        } catch (e) { err(res, e); }
    };

    public getCatalogos = async (_req: Request, res: Response): Promise<void> => {
        try {
            const catalogos = CacheService.getInstance().getCatalogos();
            ok(res, catalogos);
        } catch (e) { err(res, e); }
    };
}
