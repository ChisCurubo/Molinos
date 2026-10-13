import { Request, Response } from 'express';
import { CacheService } from '../../services/cache/cache.service';
import { IInfoService } from '../../ports/info/service_port/info.service.interface';
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
                { grupo: 'Entradas MPE', metodo: 'GET',   ruta: '/entradas/stats',                  descripcion: 'KPIs del tablero (total_registros, sin_procesar, ton_humedo_pendiente, volquetas_activas)' },
                { grupo: 'Entradas MPE', metodo: 'PUT',   ruta: '/entradas/:id',                    descripcion: 'Editar entrada (recalcula flete)', body: { peso_llegada_planta: 13000, id_mina: 1 } },
                { grupo: 'Entradas MPE', metodo: 'DELETE', ruta: '/entradas/:id',                   descripcion: 'Borrar entrada (limpia inventario si no hay análisis; 409 si no)' },
                { grupo: 'Entradas MPE', metodo: 'PATCH', ruta: '/entradas/:id/estado',             descripcion: 'Cambiar estado', body: { estado: 'pagada' } },
                { grupo: 'Entradas MPE', metodo: 'PATCH', ruta: '/entradas/:id/cancelar',           descripcion: 'Cancelar entrada', body: { motivo: 'Error de registro' } },
                // Análisis
                { grupo: 'Análisis', metodo: 'POST',  ruta: '/analisis',                                descripcion: 'FASES 2-5: Registrar análisis y recalcular', body: { id_entrada: 1, id_tipo_analisis: 1, numero_analisis: 'AN-002', toneladas: 10.2, porcentaje_humedad: 15.0, au_concentrado: 14.0, ag_concentrado: 12.0, au_falso: 15.5 } },
                { grupo: 'Análisis', metodo: 'POST',  ruta: '/analisis/cabeza',                         descripcion: 'Registrar análisis de Cabeza (tipo 1). Sin numero_analisis → AN-{mina}-{numero_volqueta}', body: { id_entrada: 1, numero_analisis: null, porcentaje_humedad: 50, au_concentrado: 120, au_falso: 8, ag_concentrado: 0 } },
                { grupo: 'Análisis', metodo: 'POST',  ruta: '/analisis',                                descripcion: 'Análisis del CONCENTRADO de un lote (tipo 2). Se pasa id_material_concentrado (NO id_entrada); solo requiere humedad + au + nombre. El backend calcula toneladas_seco y tenores sobre el lote', body: { id_material_concentrado: 1, numero_analisis: 'AN-LOTE-1', porcentaje_humedad: 0.13, au_concentrado: 120, ag_concentrado: 500 } },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/:id',                            descripcion: 'Análisis por ID propio' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/entrada/:id_entrada',            descripcion: 'Todos los análisis de una entrada' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/entrada/:id_entrada/cabeza',     descripcion: 'Solo el análisis Cabeza' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/minero/:id_minero',              descripcion: 'Análisis históricos de un minero' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/mina/:id_mina',                  descripcion: 'Análisis históricos de una mina' },
                { grupo: 'Análisis', metodo: 'GET',   ruta: '/analisis/fecha/:fecha',                   descripcion: 'Análisis por fecha de la entrada' },
                { grupo: 'Análisis', metodo: 'PUT',   ruta: '/analisis/:id',                            descripcion: 'Corregir análisis (recalcula MPE)', body: { id_entrada: 180, porcentaje_humedad: 20.0, au_falso: 18.0, au_concentrado: 20.0, ag_concentrado: 15.0 } },
                { grupo: 'Análisis', metodo: 'PATCH', ruta: '/analisis/:id/pago',                       descripcion: 'Marcar análisis como pagado', body: { estado: 'pagado' } },
                { grupo: 'Análisis', metodo: 'PATCH', ruta: '/analisis/:id/valor',                      descripcion: 'Registrar el valor cobrado del análisis', body: { valor_analisis: 150000 } },
                { grupo: 'Análisis', metodo: 'DELETE', ruta: '/analisis/:id',                           descripcion: 'Eliminar análisis (revierte entrada a pendiente; 409 si viaje/pagada)' },
                // Volqueta
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta',                         descripcion: 'Lista de vehículos con dueño' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/:id',                     descripcion: 'Detalle de vehículo' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/dueno/:id_dueno',         descripcion: 'Vehículos de un dueño' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/:id/entradas',            descripcion: 'Historial de entradas del vehículo' },
                { grupo: 'Volqueta', metodo: 'GET', ruta: '/volqueta/:id/entradas/pendientes', descripcion: 'Entradas con flete pendiente' },
                { grupo: 'Volqueta', metodo: 'POST', ruta: '/volqueta',                        descripcion: 'Crear volqueta', body: { id_dueno_volqueta: 1, placa: 'ABC-123', tipo_vehiculo: 'Doble troque', conductor: 'Pedro', conductor_cc: '80111222', capacidad_ton: 30, activo: 1 } },
                { grupo: 'Volqueta', metodo: 'PUT', ruta: '/volqueta/:id',                     descripcion: 'Actualizar volqueta' },
                { grupo: 'Volqueta', metodo: 'DELETE', ruta: '/volqueta/:id',                  descripcion: 'Eliminar volqueta' },
                { grupo: 'Dueños', metodo: 'GET', ruta: '/volqueta/dueno',                     descripcion: 'Listar dueños de volqueta' },
                { grupo: 'Dueños', metodo: 'POST', ruta: '/volqueta/dueno',                    descripcion: 'Crear dueño', body: { nombre: 'ANIBAL', titular: 'Anibal Perez', cc: '71234567', banco: 'Bancolombia', numero_cuenta: '123456789', alias: 'Amarilla', telefono: '3001234567', nequi: false } },
                { grupo: 'Dueños', metodo: 'PUT', ruta: '/volqueta/dueno/:id',                 descripcion: 'Actualizar dueño', body: { banco: 'Davivienda', numero_cuenta: '987654321', nequi: true } },
                { grupo: 'Dueños', metodo: 'DELETE', ruta: '/volqueta/dueno/:id',              descripcion: 'Eliminar dueño' },
                // Mina, Mineros y Zonas
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina/catalogo/mineros',            descripcion: 'Catálogo de mineros activos' },
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina/catalogo/mineros-con-minas', descripcion: 'Mineros con sus minas anidadas' },
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina/catalogo/zonas',             descripcion: 'Catálogo de zonas con su tarifa de flete vigente' },
                { grupo: 'Mina', metodo: 'POST', ruta: '/mina/minero',      descripcion: 'Registrar un minero', body: { nombre: 'Juan Perez', alias: 'Juancho', metodo_calculo: 'por_gramo', estado: 'activo' } },
                { grupo: 'Mina', metodo: 'PUT',  ruta: '/mina/minero/:id',  descripcion: 'Actualizar minero', body: { alias: 'Juancho', metodo_calculo: 'por_tonelada' } },
                { grupo: 'Mina', metodo: 'DELETE', ruta: '/mina/minero/:id', descripcion: 'Eliminar minero' },
                { grupo: 'Mina', metodo: 'POST', ruta: '/mina/zona',        descripcion: 'Registrar una zona (valor_tonelada = tarifa de flete)', body: { nombre: 'Zona Norte', descripcion: '', valor_tonelada: 100000 } },
                { grupo: 'Mina', metodo: 'PUT',  ruta: '/mina/zona/:id',    descripcion: 'Actualizar zona / versionar su tarifa', body: { nombre: 'Zona Norte', valor_tonelada: 120000 } },
                { grupo: 'Mina', metodo: 'DELETE', ruta: '/mina/zona/:id',  descripcion: 'Eliminar zona + historial de tarifas (409 ZONA_EN_USO si hay minas)' },
                { grupo: 'Mina', metodo: 'POST', ruta: '/mina',             descripcion: 'Registrar una mina', body: { nombre: 'Mina El Tesoro', id_minero: 1, id_zona: 1, ubicacion: 'Zaragoza', estado: 'activa' } },
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina',             descripcion: 'Todas las minas' },
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina/:id',         descripcion: 'Detalle de una mina (incluye tarifa_flete_tonelada)' },
                { grupo: 'Mina', metodo: 'PUT',  ruta: '/mina/:id',         descripcion: 'Actualizar mina (parcial)', body: { ubicacion: 'Vereda Y' } },
                { grupo: 'Mina', metodo: 'DELETE', ruta: '/mina/:id',       descripcion: 'Eliminar mina' },
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina/:id/entradas', descripcion: 'Entradas históricas de la mina' },
                { grupo: 'Mina', metodo: 'GET',  ruta: '/mina/:id/resumen',  descripcion: 'Resumen/KPIs agregados de la mina' },
                // Tarifa Zona (flete por zona) — CRUD dedicado. valor_tonelada alimenta costo_volqueta de la entrada
                { grupo: 'Tarifa Zona', metodo: 'GET',    ruta: '/mina/tarifa-zona',     descripcion: 'Listar tarifas de flete por zona (con historial)' },
                { grupo: 'Tarifa Zona', metodo: 'GET',    ruta: '/mina/tarifa-zona/:id', descripcion: 'Detalle de una tarifa de zona' },
                { grupo: 'Tarifa Zona', metodo: 'POST',   ruta: '/mina/tarifa-zona',     descripcion: 'Crear tarifa de flete (versiona la vigente de la zona si entra activa). Acepta valor_tonelada | tarifa', body: { id_zona: 1, valor_tonelada: 130000, vigente_desde: null, activo: true } },
                { grupo: 'Tarifa Zona', metodo: 'PUT',    ruta: '/mina/tarifa-zona/:id', descripcion: 'Editar tarifa de zona', body: { valor_tonelada: 140000, activo: true } },
                { grupo: 'Tarifa Zona', metodo: 'DELETE', ruta: '/mina/tarifa-zona/:id', descripcion: 'Eliminar tarifa de zona' },
                // Agua Planta
                { grupo: 'Agua', metodo: 'POST', ruta: '/agua',             descripcion: 'Registrar viaje de agua', body: { id_vehiculo: 1, fecha: '2026-07-03', valor_viaje: 50000, cantidad_viajes: 1, acpm: 0, comprobante_url: 'https://ejemplo.com/recibo.png' } },
                { grupo: 'Agua', metodo: 'PUT',  ruta: '/agua/:id',         descripcion: 'Actualizar viaje de agua', body: { valor_viaje: 60000, cantidad_viajes: 2, acpm: 10000, comprobante_url: 'https://ejemplo.com/nuevo_recibo.png' } },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/viajes',      descripcion: 'Listar viajes de agua', params: { desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD' } },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/resumen',     descripcion: 'Resumen por dueño', params: { desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD' } },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/dueno/:id_dueno', descripcion: 'Resumen total y lista de viajes de un dueño específico' },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/reporte-mensual', descripcion: 'Reporte del período agrupado por dueño con arrastre de saldo (saldo_inicio + neto_mes - abonado = saldo_fin). Acepta desde/hasta o mes/anio', params: { mes: 8, anio: 2026 } },
                { grupo: 'Agua', metodo: 'GET',  ruta: '/agua/:id',             descripcion: 'Obtener un viaje de agua específico por ID' },
                // Procesamiento (concentrado)
                { grupo: 'Procesamiento', metodo: 'POST', ruta: '/concentrado',              descripcion: 'Iniciar un lote de concentrado (en_proceso)', body: { codigo: 'LOTE-001', fecha_inicio: '2026-08-01' } },
                { grupo: 'Procesamiento', metodo: 'POST', ruta: '/concentrado/:id/procesar', descripcion: 'Agregar material al molino. id_entradas es un ARREGLO; distribuye toneladas_procesadas_seco proporcionalmente', body: { id_entradas: [1], toneladas_procesadas_seco: 8.5 } },
                { grupo: 'Procesamiento', metodo: 'PUT',  ruta: '/concentrado/:id/cerrar',   descripcion: 'Cerrar lote y enviarlo a canoa (calcula seco, maquila y crea Inventario_Lote)', body: { toneladas_humedo: 5, porcentaje_humedad: 0.1, fecha_fin: '2026-08-05', hizo_molienda: 1, hizo_flotacion: 0, hizo_relave: 0, hizo_filtroprensa: 1, ubicacion_canoa: 'Canoa 1' } },
                { grupo: 'Procesamiento', metodo: 'PUT',  ruta: '/concentrado/:id',          descripcion: 'Editar campos básicos del lote (whitelist: codigo, procesos, ubicacion_canoa, precio_maquila_por_ton)', body: { codigo: 'LOTE-001B', comentarios: 'Editado' } },
                { grupo: 'Procesamiento', metodo: 'DELETE', ruta: '/concentrado/:id/material/:idEntrada', descripcion: 'Desvincular una entrada de un lote en_proceso (devuelve su stock al inventario)' },
                { grupo: 'Procesamiento', metodo: 'DELETE', ruta: '/concentrado/:id',        descripcion: 'Eliminar un lote en_proceso (devuelve todo el material y borra sus análisis). 409 si cerrado o en viajes' },
                // Viajes / Despachos
                { grupo: 'Viajes', metodo: 'POST',   ruta: '/viajes',                          descripcion: 'Crear la cabecera de un viaje', body: { numero_viaje: '13-1', fecha: '2026-08-10', comentarios: 'Viaje 13-1' } },
                { grupo: 'Viajes', metodo: 'POST',   ruta: '/viajes/:id/lineas',               descripcion: 'Asignar un lote al viaje. Solo se envía id_material_concentrado; el backend deriva humedad/seco/peso/tenores/gramos del lote y su análisis. total_concentrado_humedo opcional (si se omite despacha todo lo disponible); valor_total y concepto opcionales. El trigger descuenta stock y fija costo_maquila', body: { id_material_concentrado: 1, total_concentrado_humedo: 5, valor_total: 0 } },
                { grupo: 'Viajes', metodo: 'DELETE', ruta: '/viajes/:idViaje/lineas/:idLinea',  descripcion: 'Eliminar una línea del viaje (el trigger devuelve stock al lote)' },
                { grupo: 'Viajes', metodo: 'DELETE', ruta: '/viajes/:id',                       descripcion: 'Eliminar un viaje completo (borra sus líneas devolviendo stock y luego la cabecera)' },
                // Precios
                { grupo: 'Precios', metodo: 'GET',  ruta: '/precios',        descripcion: 'Listar precios con filtros (id_minero | id_zona | alcance=general | activo). Cada fila trae alcance', params: { id_minero: '', id_zona: '', alcance: 'general', activo: 'true' } },
                { grupo: 'Precios', metodo: 'GET',  ruta: '/precio/calcular', descripcion: 'Simular precio aplicable', params: { idMinero: 1, metodo: 'por_gramo', tenorFalso: 10, fechaEntrada: '2026-08-01' } },
                { grupo: 'Precios', metodo: 'POST', ruta: '/precios/lote',  descripcion: 'Registrar tarifas por lotes con versionado por alcance (minero/zona/general)', body: { id_minero: 1, metodo: 'por_gramo', fecha_inicio: '2026-07-03', intervalos: [{ min: 0, max: 10, precio_por_gramo: 150000, precio_por_tonelada: 0 }] } },
                { grupo: 'Precios', metodo: 'PUT',  ruta: '/precios/:id',    descripcion: 'Editar un intervalo (inactiva el actual, inserta reemplazo activo)', body: { min: 0, max: 12, precio_por_gramo: 210000, precio_por_tonelada: 0 } },
                // Precio Material — CRUD referencial (tabla de referencia; no interviene en cálculos del flujo actual)
                { grupo: 'Precio Material', metodo: 'GET',    ruta: '/mina/precio-material',     descripcion: 'Listar precios de material (tabla de referencia)' },
                { grupo: 'Precio Material', metodo: 'GET',    ruta: '/mina/precio-material/:id', descripcion: 'Detalle de un precio de material' },
                { grupo: 'Precio Material', metodo: 'POST',   ruta: '/mina/precio-material',     descripcion: 'Crear precio de material (referencia)', body: { id_minero: null, id_zona: null, metodo: 'por_tonelada', precio_por_gramo: null, precio_por_tonelada: 650000, intervalo_tenor_min: 0, intervalo_tenor_max: 9999, fecha_inicio: '2026-08-01', fecha_fin: null, activo: true } },
                { grupo: 'Precio Material', metodo: 'PUT',    ruta: '/mina/precio-material/:id', descripcion: 'Editar precio de material', body: { precio_por_tonelada: 700000, activo: true } },
                { grupo: 'Precio Material', metodo: 'DELETE', ruta: '/mina/precio-material/:id', descripcion: 'Eliminar precio de material' },
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
                { grupo: 'Préstamos Financieros', metodo: 'PATCH', ruta: '/prestamos-financieros/:id', descripcion: 'Actualizar parcialmente préstamo financiero' },
                { grupo: 'Préstamos Financieros', metodo: 'DELETE', ruta: '/prestamos-financieros/:id', descripcion: 'Eliminar préstamo financiero (409 si ya tiene abonos/ajustes: saldo_pendiente != monto_principal)' },
                // Interés + abonos — capitaliza tasa_interes mensual sobre saldo_pendiente; el abono es plata real (CxP 'Préstamo financiero') (2026-10-01)
                { grupo: 'Préstamos Financieros', metodo: 'GET',  ruta: '/prestamos-financieros/:id/interes/proyeccion', descripcion: 'Proyectar el interés que se acumularía a hoy (o a `fecha`), sin persistir', params: { fecha: '' } },
                { grupo: 'Préstamos Financieros', metodo: 'POST', ruta: '/prestamos-financieros/:id/interes',            descripcion: 'Acumular (capitalizar) el interés del período transcurrido desde el último movimiento', body: { fecha: '2026-10-01' } },
                { grupo: 'Préstamos Financieros', metodo: 'POST', ruta: '/prestamos-financieros/:id/abonos',             descripcion: 'Registrar un abono real (reduce saldo_pendiente, CxP pagada de inmediato)', body: { valor: 500000, fecha_abono: '2026-10-01', metodo_pago: 'transferencia', comprobante_url: 'https://ejemplo.com/comprobante.png' } },
                { grupo: 'Préstamos Financieros', metodo: 'GET',  ruta: '/prestamos-financieros/:id/movimientos',        descripcion: 'Historial de movimientos (intereses + abonos), orden cronológico' },
                // Tesorería — Fase 2 de EMPLEADOS_PRESTAMOS_plan.md (2026-09-22): ingresos reales de la
                // empresa + flujo de caja (ingresos vs. gastos, solo movimientos de caja real).
                { grupo: 'Tesorería', metodo: 'POST', ruta: '/ingresos', descripcion: 'Registrar ingreso de tesorería (aporte de socio, venta, cobro manual, etc.)', body: { id_categoria: 3, concepto: 'Aporte socio Camilo', valor: 2000000, fecha: '2026-09-22' } },
                { grupo: 'Tesorería', metodo: 'GET', ruta: '/ingresos', descripcion: 'Listar ingresos de tesorería', params: { id_categoria: '', desde: '', hasta: '' } },
                { grupo: 'Tesorería', metodo: 'GET', ruta: '/ingresos/:id', descripcion: 'Ver un ingreso por id' },
                { grupo: 'Tesorería', metodo: 'PUT', ruta: '/ingresos/:id', descripcion: 'Editar un ingreso (409 si viene de un préstamo financiero)' },
                { grupo: 'Tesorería', metodo: 'DELETE', ruta: '/ingresos/:id', descripcion: 'Eliminar un ingreso (409 si viene de un préstamo financiero)' },
                { grupo: 'Tesorería', metodo: 'GET', ruta: '/vistas/flujo-caja', descripcion: 'Flujo de caja del mes: ingresos (tesorería + cobros CxC) vs. gastos (Abonos_CxP) con desglose por categoría (Material/Flete/Nómina/Mula/etc.), solo métodos de caja real', params: { mes: '', anio: '' } },
                { grupo: 'Tesorería', metodo: 'GET', ruta: '/vistas/flujo-caja/historico', descripcion: 'Saldo acumulado histórico total, con gastos desglosados por categoría' },
                { grupo: 'Tesorería', metodo: 'GET', ruta: '/categorias-ingreso', descripcion: 'Catálogo de categorías de Ingresos_Tesoreria (selector para el front)' },
                // Pago de MATERIAL — CxP agrupada por minero + abonos con prorrateo (2026-08-31)
                { grupo: 'Pago Material', metodo: 'POST',   ruta: '/material',                descripcion: 'Agrupar volquetas de un minero en una cuenta por pagar', body: { entradas: [1, 2], concepto: 'Material Julio', fecha_limite: '2026-08-31' } },
                { grupo: 'Pago Material', metodo: 'GET',    ruta: '/material',                descripcion: 'Tablero de cuentas de material', params: { id_minero: '', estado: '' } },
                { grupo: 'Pago Material', metodo: 'GET',    ruta: '/material/:id',            descripcion: 'Detalle de la cuenta (volquetas prorrateadas + abonos)' },
                { grupo: 'Pago Material', metodo: 'PATCH',  ruta: '/material/:id',            descripcion: 'Agregar/quitar volquetas, concepto o fecha_limite', body: { agregar_entradas: [], quitar_entradas: [] } },
                { grupo: 'Pago Material', metodo: 'DELETE', ruta: '/material/:id',            descripcion: 'Anular la cuenta (409 si ya tiene abonos)' },
                { grupo: 'Pago Material', metodo: 'POST',   ruta: '/material/:id/abonos',     descripcion: 'Registrar un abono (o pagar con saldo_a_favor)', body: { valor: 2000000, fecha_abono: '2026-08-09', metodo_pago: 'transferencia', comprobante_url: 'https://ejemplo.com/comprobante.png' } },
                { grupo: 'Pago Material', metodo: 'PATCH',  ruta: '/material/abonos/:idAbono', descripcion: 'Corregir un abono' },
                { grupo: 'Pago Material', metodo: 'DELETE', ruta: '/material/abonos/:idAbono', descripcion: 'Eliminar un abono' },
                { grupo: 'Pago Material', metodo: 'GET',    ruta: '/material/abonos',          descripcion: 'Todos los abonos de material (todas las cuentas), paginados de a 50', params: { id_minero: '', desde: '', hasta: '', metodo_pago: '', page: 1, limit: 50 } },
                // Pago de FLETE — CxP por (dueño, mes) + cascada de abonos + neto con ACPM (2026-09-05)
                { grupo: 'Pago Flete', metodo: 'GET',    ruta: '/flete/deuda',            descripcion: 'Dashboard: deuda de flete por dueño (con positivos de gasolina)' },
                { grupo: 'Pago Flete', metodo: 'GET',    ruta: '/flete/dueno/:id',        descripcion: 'Estado de cuenta del dueño (meses + viajes + abonos)', params: { mes: '', anio: '' } },
                { grupo: 'Pago Flete', metodo: 'POST',   ruta: '/flete/dueno/:id/abonos', descripcion: 'Abonar en cascada (mes más viejo primero)', body: { valor: 500000, fecha_abono: '2026-09-05', comprobante_url: 'https://ejemplo.com/comprobante.png' } },
                { grupo: 'Pago Flete', metodo: 'PATCH',  ruta: '/flete/abonos/:idAbono',  descripcion: 'Corregir un abono de flete' },
                { grupo: 'Pago Flete', metodo: 'DELETE', ruta: '/flete/abonos/:idAbono',  descripcion: 'Eliminar un abono de flete' },
                { grupo: 'Pago Flete', metodo: 'GET',    ruta: '/flete/abonos',           descripcion: 'Todos los abonos de flete (todas las cuentas), paginados de a 50', params: { id_dueno_volqueta: '', desde: '', hasta: '', metodo_pago: '', page: 1, limit: 50 } },
                // Pago de AGUA — mismo motor que flete, por registro de agua_planta (2026-09-05)
                { grupo: 'Pago Agua', metodo: 'GET',    ruta: '/agua/deuda',            descripcion: 'Dashboard: deuda de agua por dueño (con positivos de gasolina)' },
                { grupo: 'Pago Agua', metodo: 'GET',    ruta: '/agua/dueno/:id',        descripcion: 'Estado de cuenta del dueño (meses + registros + abonos)', params: { mes: '', anio: '' } },
                { grupo: 'Pago Agua', metodo: 'POST',   ruta: '/agua/dueno/:id/abonos', descripcion: 'Abonar en cascada (mes más viejo primero)', body: { valor: 100000, fecha_abono: '2026-09-05', comprobante_url: 'https://ejemplo.com/comprobante.png' } },
                { grupo: 'Pago Agua', metodo: 'PATCH',  ruta: '/agua/abonos/:idAbono',  descripcion: 'Corregir un abono de agua' },
                { grupo: 'Pago Agua', metodo: 'DELETE', ruta: '/agua/abonos/:idAbono',  descripcion: 'Eliminar un abono de agua' },
                { grupo: 'Pago Agua', metodo: 'GET',    ruta: '/agua/abonos',           descripcion: 'Todos los abonos de agua (todas las cuentas), paginados de a 50', params: { id_dueno_volqueta: '', desde: '', hasta: '', metodo_pago: '', page: 1, limit: 50 } },
                // Combustible — registro (efectivo=ya resuelto | credito=línea con la gasolinera) + reportes (2026-09-16)
                { grupo: 'Combustible', metodo: 'GET',    ruta: '/combustible',                     descripcion: 'Listar consumos/adelantos de combustible', params: { desde: '', hasta: '', id_gasolinera: '', id_dueno_volqueta: '', tipo_consumo: '', forma_pago: '' } },
                { grupo: 'Combustible', metodo: 'POST',   ruta: '/combustible',                     descripcion: 'Registrar un tanqueo/suministro manual (planta/maquinaria/vehículo). forma_pago=credito exige id_gasolinera; tipo_consumo=vehiculo exige id_vehiculo o id_dueno_volqueta', body: { tipo_consumo: 'planta', forma_pago: 'credito', id_gasolinera: 4, id_planta: 1, fecha: '2026-09-16', descripcion: '40 galones ACPM para tambores', valor: 320000, comprobante_url: 'https://ejemplo.com/comprobante.png' } },
                { grupo: 'Combustible', metodo: 'GET',    ruta: '/combustible/:id',                 descripcion: 'Detalle de un registro de combustible' },
                { grupo: 'Combustible', metodo: 'PUT',    ruta: '/combustible/:id',                 descripcion: 'Editar un registro manual (400 si es ACPM automático de flete/agua)', body: { valor: 340000 } },
                { grupo: 'Combustible', metodo: 'DELETE', ruta: '/combustible/:id',                 descripcion: 'Eliminar un registro manual (400 si es ACPM automático de flete/agua)' },
                { grupo: 'Combustible', metodo: 'GET',    ruta: '/combustible/dueno/:id/neto-flete', descripcion: 'Flete neto del dueño con arrastre de ACPM' },
                { grupo: 'Combustible', metodo: 'GET',    ruta: '/combustible/resumen-mensual',     descripcion: 'Total agrupado por mes, desglosado por forma_pago y tipo_consumo', params: { anio: '', forma_pago: '', tipo_consumo: '' } },
                { grupo: 'Combustible', metodo: 'GET',    ruta: '/combustible/kpis',                descripcion: 'Dashboard: mes actual vs anterior, variación %, promedio 12 meses, histórico, top gasolineras/dueños' },
                // Pago de COMBUSTIBLE a la gasolinera — CxP por (gasolinera, mes) + cascada de abonos, sin neteo (2026-09-16)
                { grupo: 'Pago Combustible', metodo: 'GET',    ruta: '/combustible/pagos/deuda',                     descripcion: 'Dashboard: deuda pendiente por gasolinera' },
                { grupo: 'Pago Combustible', metodo: 'GET',    ruta: '/combustible/pagos/gasolinera/:id',            descripcion: 'Estado de cuenta de la gasolinera (meses + consumos + abonos)', params: { mes: '', anio: '' } },
                { grupo: 'Pago Combustible', metodo: 'POST',   ruta: '/combustible/pagos/gasolinera/:id/abonos',     descripcion: 'Abonar en cascada (mes más viejo primero)', body: { valor: 800000, fecha_abono: '2026-09-16', metodo_pago: 'transferencia', comprobante_url: 'https://ejemplo.com/comprobante.png' } },
                { grupo: 'Pago Combustible', metodo: 'PATCH',  ruta: '/combustible/pagos/abonos/:idAbono',           descripcion: 'Corregir un abono de combustible' },
                { grupo: 'Pago Combustible', metodo: 'DELETE', ruta: '/combustible/pagos/abonos/:idAbono',           descripcion: 'Eliminar un abono de combustible' },
                { grupo: 'Pago Combustible', metodo: 'GET',    ruta: '/combustible/pagos/abonos',                    descripcion: 'Todos los abonos de combustible (todas las cuentas), paginados de a 50', params: { id_gasolinera: '', desde: '', hasta: '', metodo_pago: '', page: 1, limit: 50 } },
                // Proveedores — entidad real (transportadoras de mula, laboratorios, gasolineras, etc.) + su catálogo de categorías (2026-09-13)
                { grupo: 'Proveedores', metodo: 'GET',    ruta: '/proveedores/categorias',     descripcion: 'Listar categorías de proveedor' },
                { grupo: 'Proveedores', metodo: 'GET',    ruta: '/proveedores/categorias/:id', descripcion: 'Ver una categoría de proveedor' },
                { grupo: 'Proveedores', metodo: 'POST',   ruta: '/proveedores/categorias',     descripcion: 'Crear categoría de proveedor', body: { nombre: 'Transportadora Mula', descripcion: '' } },
                { grupo: 'Proveedores', metodo: 'PUT',    ruta: '/proveedores/categorias/:id', descripcion: 'Editar categoría de proveedor' },
                { grupo: 'Proveedores', metodo: 'DELETE', ruta: '/proveedores/categorias/:id', descripcion: 'Eliminar categoría de proveedor' },
                { grupo: 'Proveedores', metodo: 'GET',    ruta: '/proveedores',     descripcion: 'Listar proveedores' },
                { grupo: 'Proveedores', metodo: 'POST',   ruta: '/proveedores',     descripcion: 'Crear proveedor', body: { nombre: 'Transportes El Faro', id_categoria: 1, nit: '900123456-7', telefono: '3001234567' } },
                { grupo: 'Proveedores', metodo: 'GET',    ruta: '/proveedores/:id', descripcion: 'Ver un proveedor' },
                { grupo: 'Proveedores', metodo: 'PUT',    ruta: '/proveedores/:id', descripcion: 'Actualizar proveedor' },
                { grupo: 'Proveedores', metodo: 'DELETE', ruta: '/proveedores/:id', descripcion: 'Eliminar proveedor (409 si está en uso por una FK, ej. despachos de mula)' },
                // Pago de MULAS — despacho a proveedor (transportadora Barranquilla) + cascada de abonos (2026-09-13)
                { grupo: 'Pago Mula', metodo: 'POST',   ruta: '/mulas',                                descripcion: 'Registrar un despacho de mula', body: { id_proveedor: 1, valor: 3500000, fecha: '2026-09-13', id_viaje: null } },
                { grupo: 'Pago Mula', metodo: 'GET',    ruta: '/mulas',                                descripcion: 'Listar despachos', params: { id_proveedor: '', id_viaje: '', estado: '' } },
                { grupo: 'Pago Mula', metodo: 'GET',    ruta: '/mulas/:id',                            descripcion: 'Detalle de un despacho' },
                { grupo: 'Pago Mula', metodo: 'PATCH',  ruta: '/mulas/:id',                            descripcion: 'Editar un despacho (incluye vincular/desvincular id_viaje)' },
                { grupo: 'Pago Mula', metodo: 'DELETE', ruta: '/mulas/:id',                            descripcion: 'Eliminar un despacho (solo si no tiene abonos)' },
                { grupo: 'Pago Mula', metodo: 'POST',   ruta: '/mulas/proveedor/:idProveedor/abonos',  descripcion: 'Abonar en cascada al proveedor (despacho más viejo primero)', body: { valor: 1000000, fecha_abono: '2026-09-13', metodo_pago: 'transferencia', comprobante_url: 'https://ejemplo.com/comprobante.png' } },
                { grupo: 'Pago Mula', metodo: 'PATCH',  ruta: '/mulas/abonos/:idAbono',                descripcion: 'Corregir un abono de mula' },
                { grupo: 'Pago Mula', metodo: 'DELETE', ruta: '/mulas/abonos/:idAbono',                descripcion: 'Eliminar un abono de mula' },
                { grupo: 'Pago Mula', metodo: 'GET',    ruta: '/mulas/abonos',                         descripcion: 'Todos los abonos de mula (todos los despachos), paginados de a 50', params: { id_proveedor: '', desde: '', hasta: '', metodo_pago: '', page: 1, limit: 50 } },
                { grupo: 'Pago Mula', metodo: 'GET',    ruta: '/mulas/resumen',                        descripcion: 'KPIs del período (despachos, facturado, retenido, pagado, pendiente, descuadres)', params: { desde: '', hasta: '', id_proveedor: '' } },
                { grupo: 'Pago Mula', metodo: 'GET',    ruta: '/mulas/viajes',                         descripcion: 'Trazabilidad por viaje: proveedor + cuenta + abonos' },
                // Anticipos a terceros (minero/dueño de volqueta/proveedor) — crédito que se descuenta de pagos futuros (2026-09-13)
                { grupo: 'Anticipos', metodo: 'POST',   ruta: '/anticipos',     descripcion: 'Registrar un anticipo (genera CxP pagada de inmediato + espejo en Saldo_A_Favor origen=anticipo)', body: { tercero: 'minero', id: 1, monto: 500000, comprobante_url: 'https://ejemplo.com/comprobante.png', fecha: '2026-09-13', metodo_pago: 'efectivo', descripcion: 'Adelanto de material' } },
                { grupo: 'Anticipos', metodo: 'GET',    ruta: '/anticipos',     descripcion: 'Listar anticipos', params: { tercero: 'minero|dueno_volqueta|proveedor', id: '', estado: '' } },
                { grupo: 'Anticipos', metodo: 'GET',    ruta: '/anticipos/:id', descripcion: 'Detalle de un anticipo + historial de descuentos aplicados' },
                { grupo: 'Anticipos', metodo: 'DELETE', ruta: '/anticipos/:id', descripcion: 'Anular un anticipo (solo si monto_usado = 0, nada se ha consumido aún)' },
            ]
        },
        {
            nombre: 'nomina', prefijo: '/api/v1/nomina', requiere_token: true,
            endpoints: [
                { grupo: 'Empleados', metodo: 'GET', ruta: '/empleados',         descripcion: 'Lista de empleados' },
                { grupo: 'Empleados', metodo: 'GET', ruta: '/empleados/:id',     descripcion: 'Detalle de empleado' },
                { grupo: 'Empleados', metodo: 'POST', ruta: '/empleados',        descripcion: 'Crear empleado' },
                { grupo: 'Empleados', metodo: 'PUT', ruta: '/empleados/:id',     descripcion: 'Actualizar empleado' },
                { grupo: 'Empleados', metodo: 'PATCH', ruta: '/empleados/:id',   descripcion: 'Actualizar parcialmente empleado' },
                { grupo: 'Empleados', metodo: 'DELETE', ruta: '/empleados/:id',  descripcion: 'Eliminar empleado' },
                { grupo: 'Salario Empleados', metodo: 'POST', ruta: '/empleados/:id/salario',            descripcion: 'Nueva vigencia salarial (cierra la anterior)', body: { tipo_pago: 'FIJO_MENSUAL', tarifa_monto: 1500000, aplica_aux_transp: true, fecha_inicio: '2026-09-19' } },
                { grupo: 'Salario Empleados', metodo: 'GET', ruta: '/empleados/:id/salario',              descripcion: 'Configuración salarial vigente del empleado' },
                { grupo: 'Salario Empleados', metodo: 'GET', ruta: '/empleados/:id/salario/historial',    descripcion: 'Historial de vigencias salariales del empleado' },
                { grupo: 'Salario Empleados', metodo: 'PUT', ruta: '/empleados/salario/:idSalario',       descripcion: 'Editar una vigencia salarial puntual' },
                { grupo: 'Salario Empleados', metodo: 'PATCH', ruta: '/empleados/salario/:idSalario',     descripcion: 'Editar parcialmente una vigencia salarial' },
                { grupo: 'Salario Empleados', metodo: 'DELETE', ruta: '/empleados/salario/:idSalario',    descripcion: 'Eliminar una vigencia salarial' },
                { grupo: 'Plantas',   metodo: 'GET', ruta: '/plantas',           descripcion: 'Lista de plantas' },
                { grupo: 'Plantas',   metodo: 'POST', ruta: '/plantas',          descripcion: 'Crear planta' },
                { grupo: 'Plantas',   metodo: 'PUT', ruta: '/plantas/:id',       descripcion: 'Actualizar planta' },
                { grupo: 'Plantas',   metodo: 'DELETE', ruta: '/plantas/:id',    descripcion: 'Eliminar planta' },
                { grupo: 'Turnos',    metodo: 'GET', ruta: '/turnos',            descripcion: 'Turnos/asistencias', params: { desde: '', hasta: '', id_empleado: '', mes: '', anio: '', quincena: '' } },
                { grupo: 'Turnos',    metodo: 'POST', ruta: '/turnos',           descripcion: 'Crear turno (409 si ya existe uno para ese empleado en esa fecha)' },
                { grupo: 'Turnos',    metodo: 'PUT', ruta: '/turnos/upsert',     descripcion: 'Crear/actualizar el turno de un empleado en un día — grilla de asistencia /nomina/calendario, a lo sumo un turno por (id_empleado, fecha). es_festivo suma +75% de recargo dominical/festivo aparte del domingo, que se detecta solo', body: { id_empleado: 1, fecha: '2026-09-27', id_tipo_turno: 2, horas_trabajadas: 8, presente: true, es_festivo: false } },
                { grupo: 'Turnos',    metodo: 'DELETE', ruta: '/turnos/dia',     descripcion: '"Sin turno (limpiar)": borra el turno de un empleado en un día si existía', params: { id_empleado: 1, fecha: '2026-09-27' } },
                { grupo: 'Turnos',    metodo: 'PUT', ruta: '/turnos/:id',        descripcion: 'Actualizar turno' },
                { grupo: 'Turnos',    metodo: 'DELETE', ruta: '/turnos/:id',     descripcion: 'Eliminar turno' },
                { grupo: 'Turnos',    metodo: 'GET', ruta: '/turnos/tipos',      descripcion: 'Catálogo de tipos de turno (mañana/tarde/noche) con su recargo_porcentaje PROPIO (política interna) — el recargo nocturno legal (+35%) y dominical/festivo (+75%) se calculan aparte y se suman solos, no van en este campo' },
                { grupo: 'Turnos',    metodo: 'GET', ruta: '/turnos/tipos/:id',  descripcion: 'Detalle de un tipo de turno' },
                { grupo: 'Turnos',    metodo: 'POST', ruta: '/turnos/tipos',     descripcion: 'Crear tipo de turno. nombre requerido, horas en formato HH:MM[:SS], recargo_porcentaje entre 0 y 200', body: { nombre: 'TURNO 4', hora_inicio: '06:00', hora_fin: '14:00', recargo_porcentaje: 0 } },
                { grupo: 'Turnos',    metodo: 'PUT', ruta: '/turnos/tipos/:id',  descripcion: 'Editar tipo de turno (mismas validaciones que crear)', body: { recargo_porcentaje: 30 } },
                { grupo: 'Turnos',    metodo: 'DELETE', ruta: '/turnos/tipos/:id', descripcion: 'Eliminar tipo de turno' },
                { grupo: 'Jornada Nocturna Legal', metodo: 'GET', ruta: '/jornada-nocturna-legal',  descripcion: 'Histórico del corte legal de jornada nocturna (Ley 2101/2021), más reciente primero — la noche siempre termina a las 06:00, solo su inicio se ha movido' },
                { grupo: 'Jornada Nocturna Legal', metodo: 'POST', ruta: '/jornada-nocturna-legal', descripcion: 'Registrar un nuevo corte (cuando la ley vuelva a mover la jornada nocturna). 409 si ya existe un corte vigente desde esa fecha', body: { hora_inicio_nocturno: '19:00', vigente_desde: '2025-07-15' } },
                { grupo: 'Préstamos', metodo: 'POST', ruta: '/empleados/prestamos', descripcion: 'Crear préstamo a empleado' },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/empleados/prestamos', descripcion: 'Listado general de préstamos de empleados', params: { id_empleado: '' } },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/empleados/prestamos/detalle/:id', descripcion: 'Ver un préstamo de empleado por id' },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/empleados/prestamos/:idEmpleado', descripcion: 'Ver préstamos del empleado' },
                { grupo: 'Préstamos', metodo: 'PUT', ruta: '/empleados/prestamos/:id', descripcion: 'Actualizar préstamo del empleado' },
                { grupo: 'Préstamos', metodo: 'PATCH', ruta: '/empleados/prestamos/:id', descripcion: 'Actualizar parcialmente préstamo del empleado' },
                { grupo: 'Préstamos', metodo: 'DELETE', ruta: '/empleados/prestamos/:id', descripcion: 'Eliminar préstamo del empleado (409 si tiene CxP/CxC asociada)' },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/vistas/saldo-prestamos-empleado',      descripcion: 'Saldo de préstamos de todos los empleados' },
                { grupo: 'Préstamos', metodo: 'GET', ruta: '/vistas/saldo-prestamos-empleado/:id',  descripcion: 'Saldo de préstamos de un empleado' },
                { grupo: 'Nómina Quincenal', metodo: 'GET', ruta: '/empleados/liquidaciones/preview', descripcion: 'Previsualizar cálculo de una quincena (fijo/variable), sin persistir. Incluye aporte_salud/aporte_pension (seguridad social, se resta del neto), total_recargo_dominical_festivo (informativo, ya incluido en el bruto) y detalle_turnos[] (% de recargo y monto por cada turno de la quincena)', params: { id_empleado: '', anio: '', mes: '', quincena: '1|2' } },
                { grupo: 'Nómina Quincenal', metodo: 'GET', ruta: '/empleados/liquidaciones/preview-grupal', descripcion: 'Previsualizar todos los empleados de una quincena en un solo request (errores puntuales por empleado no tumban el lote); cada preview trae los mismos campos que /preview, incluido detalle_turnos', params: { anio: '', mes: '', quincena: '1|2' } },
                { grupo: 'Nómina Quincenal', metodo: 'POST', ruta: '/empleados/liquidaciones', descripcion: 'Confirmar liquidación: genera CxP de Nómina, descuenta cuotas de préstamos activos y aportes de seguridad social (8% del IBC)', body: { id_empleado: 1, anio: 2026, mes: 9, quincena: 1, otros_descuentos: 0 } },
                { grupo: 'Nómina Quincenal', metodo: 'GET', ruta: '/empleados/liquidaciones', descripcion: 'Historial de liquidaciones', params: { id_empleado: '', anio: '', mes: '' } },
                { grupo: 'Nómina Quincenal', metodo: 'GET', ruta: '/empleados/liquidaciones/:id', descripcion: 'Ver una liquidación por id' },
                // Borrador editable (estado='borrador', sin CxP) — antes solo existía confirmar directo (2026-10-01)
                { grupo: 'Nómina Quincenal', metodo: 'POST',  ruta: '/empleados/liquidaciones/borrador',           descripcion: 'Crear borrador editable (no genera CxP ni descuenta préstamos)', body: { id_empleado: 1, anio: 2026, mes: 10, quincena: 1, otros_descuentos: 0 } },
                { grupo: 'Nómina Quincenal', metodo: 'PATCH', ruta: '/empleados/liquidaciones/:id',                descripcion: 'Editar otros_descuentos de un borrador (409 si ya está confirmado)', body: { otros_descuentos: 20000 } },
                { grupo: 'Nómina Quincenal', metodo: 'POST',  ruta: '/empleados/liquidaciones/:id/confirmar',      descripcion: 'Promover un borrador a confirmado: genera CxP y descuenta cuotas de préstamos activos' },
                { grupo: 'Bonos', metodo: 'POST', ruta: '/empleados/bonos', descripcion: 'Registrar bono a un empleado (genera CxP, categoría Bono empleado)', body: { id_empleado: 1, fecha: '2026-09-21', concepto: 'Bono de producción', valor: 100000 } },
                { grupo: 'Bonos', metodo: 'GET', ruta: '/empleados/bonos', descripcion: 'Listar bonos', params: { id_empleado: '', desde: '', hasta: '' } },
                { grupo: 'Bonos', metodo: 'GET', ruta: '/empleados/bonos/:id', descripcion: 'Ver un bono por id' },
                { grupo: 'Bonos', metodo: 'DELETE', ruta: '/empleados/bonos/:id', descripcion: 'Eliminar un bono (409 si ya tiene abonos)' },
                { grupo: 'Ficha Empleado', metodo: 'GET', ruta: '/empleados/:id/ficha', descripcion: 'Ficha 360: datos, salario vigente, liquidaciones, bonos, préstamos activos, prestaciones estimadas', params: { anio: '' } },
                { grupo: 'Ficha Empleado', metodo: 'GET', ruta: '/empleados/:id/prestaciones', descripcion: 'Prestaciones sociales estimadas del año (cesantías, intereses, prima, vacaciones)', params: { anio: '' } },
            ]
        },
        {
            nombre: 'info', prefijo: '/api/v1/info', requiere_token: true,
            endpoints: [
                { grupo: 'General', metodo: 'GET', ruta: '/',             descripcion: 'Mapa completo de la API (este endpoint)' },
                { grupo: 'General', metodo: 'GET', ruta: '/estadisticas', descripcion: 'Conteo de registros de las tablas principales' },
                { grupo: 'General', metodo: 'GET', ruta: '/health',       descripcion: 'Estado del servidor y conexión a BD' },
                { grupo: 'General', metodo: 'GET', ruta: '/catalogos',    descripcion: 'Catálogos en memoria (minas, mineros, zonas, dueños de volqueta)' },
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
                { grupo: '3. Procesamiento', metodo: 'POST',  ruta: '/material/concentrado/:id/procesar', descripcion: '7. Agregar material al molino (distribuye proporcionalmente entre las entradas)', body: { id_entradas: [1], toneladas_procesadas_seco: 8.5 } },
                { grupo: '3. Procesamiento', metodo: 'PUT',   ruta: '/material/concentrado/:id/cerrar', descripcion: '8. Cerrar lote y enviarlo a canoa (calcula maquila)', body: { toneladas_humedo: 5, porcentaje_humedad: 0.1, fecha_fin: '2026-07-05', hizo_molienda: 1, hizo_flotacion: 0, hizo_relave: 0, hizo_filtroprensa: 1, ubicacion_canoa: 'Canoa 1' } },
                { grupo: '4. Análisis del lote', metodo: 'POST', ruta: '/material/analisis', descripcion: '8b. Análisis del concentrado del lote (DESPUÉS de cerrar). id_material_concentrado + humedad + au + ag + nombre', body: { id_material_concentrado: 1, numero_analisis: 'AN-LOTE-1', porcentaje_humedad: 0.13, au_concentrado: 120, ag_concentrado: 500 } },
                { grupo: '5. Viajes/Despachos', metodo: 'POST',  ruta: '/material/viajes', descripcion: '9. Crear cabecera de viaje', body: { numero_viaje: '13-1', fecha: '2026-02-10', comentarios: 'Viaje 13-1' } },
                { grupo: '5. Viajes/Despachos', metodo: 'POST',  ruta: '/material/viajes/:id/lineas', descripcion: '10. Asignar lote al viaje (solo id; el resto se deriva del lote+análisis)', body: { id_material_concentrado: 1, total_concentrado_humedo: 5, valor_total: 0 } },
                { grupo: '6. Servicios', metodo: 'POST',  ruta: '/material/agua', descripcion: '11. Insertar viaje de agua', body: { id_vehiculo: 1, fecha: '2026-07-03', valor_viaje: 60000, cantidad_viajes: 1, acpm: 0, comprobante_url: 'https://ejemplo.com/recibo.png' } },
                { grupo: '7. Finanzas',  metodo: 'GET',   ruta: '/pagos/deuda/material/minero/:id', descripcion: '12. Ver cuánto debo al minero' },
                { grupo: '7. Finanzas',  metodo: 'GET',   ruta: '/pagos/deuda/flete/dueno/:id', descripcion: '13. Ver cuánto debo de flete (bus/volqueta)' },
                { grupo: '7. Finanzas',  metodo: 'GET',   ruta: '/material/vistas/excedente-empresa', descripcion: '14. Ver excedente y costo de procesar el material' }
            ]
        },
        {
            // RECONSTRUIDO 2026-09-06: este bloque existía en el archivo antes de un error de
            // sobrescritura accidental. Los pasos 2-9 se recuperaron tal cual (ya se habían leído);
            // el paso 1 se reconstruyó a partir del endpoint real POST /pagos/material — verificar
            // el texto exacto si importa (wording original no recuperable).
            nombre: 'flujo_pago_material', prefijo: '/api/v1/pagos', requiere_token: true,
            endpoints: [
                { grupo: '1. Crear cuenta',  metodo: 'POST',   ruta: '/material',                  descripcion: '1. Agrupar volquetas de un minero en una cuenta por pagar (todas deben tener precio_total > 0)', body: { entradas: [1, 2], concepto: 'Material Julio', fecha_limite: '2026-08-31' } },
                { grupo: '2. Ver prorrateo', metodo: 'GET',    ruta: '/material/:id',              descripcion: '2. Ver la cuenta recién creada: todas las volquetas en pendiente (pagado_volqueta = 0)' },
                { grupo: '3. Abonar',        metodo: 'POST',   ruta: '/material/:id/abonos',       descripcion: '3. Primera transferencia de 2.000.000 (comprobante OBLIGATORIO). La cuenta pasa a parcial. Guarda el id del abono', body: { valor: 2000000, fecha_abono: '2026-08-09', metodo_pago: 'transferencia', comprobante_url: 'https://ejemplo.com/transfer1.png', observaciones: 'Primer abono' } },
                { grupo: '3. Abonar',        metodo: 'POST',   ruta: '/material/:id/abonos',       descripcion: '3b. Segunda transferencia de 2.000.000 (otra fecha, mismo mes)', body: { valor: 2000000, fecha_abono: '2026-08-20', metodo_pago: 'nequi', comprobante_url: 'https://ejemplo.com/transfer2.png', observaciones: 'Segundo abono' } },
                { grupo: '4. Ver prorrateo', metodo: 'GET',    ruta: '/material/:id',              descripcion: '4. Ver el prorrateo tras abonar: cada volqueta pagada al mismo % del grupo; num_abonos=2' },
                { grupo: '5. Editar abono',  metodo: 'PATCH',  ruta: '/material/abonos/:idAbono',  descripcion: '5. Corregir un abono (ej. subirlo a 3.000.000). La cuenta se recalcula sola', body: { valor: 3000000 } },
                { grupo: '6. Sobrepago',     metodo: 'POST',   ruta: '/material/:id/abonos',       descripcion: '6. Pagar de MÁS: abona más que el saldo → la cuenta queda pagada y el excedente se vuelve saldo a favor del minero (revisa saldo_a_favor_generado)', body: { valor: 9999999, fecha_abono: '2026-08-28', metodo_pago: 'transferencia', comprobante_url: 'https://ejemplo.com/transfer3.png', observaciones: 'Sobrepago' } },
                { grupo: '6. Deuda minero',  metodo: 'GET',    ruta: '/deuda/material/minero/:id', descripcion: '6b. Ver la deuda del minero: trae saldo_a_favor, deuda_bruta y deuda_neta. El saldo a favor del sobrepago aparece aquí' },
                { grupo: '6c. Usar crédito', metodo: 'POST',   ruta: '/material/:idOtraCuenta/abonos', descripcion: '6c. En OTRA cuenta del mismo minero, pagar con el crédito (sin comprobante)', body: { metodo_pago: 'saldo_a_favor' } },
                { grupo: '7. Editar grupo',  metodo: 'PATCH',  ruta: '/material/:id',              descripcion: '7. (Opcional) Quitar una volqueta del grupo. Se bloquea si el nuevo total queda bajo lo ya abonado', body: { quitar_entradas: [5] } },
                { grupo: '8. Eliminar abono',metodo: 'DELETE', ruta: '/material/abonos/:idAbono',  descripcion: '8. Eliminar un abono; la cuenta vuelve a parcial/pendiente' },
                { grupo: '9. Anular grupo',  metodo: 'DELETE', ruta: '/material/:id',              descripcion: '9. Anular la cuenta. Ojo: si quedan abonos da 409 → primero elimina todos los abonos (paso 8) y luego anula' }
            ]
        }
    ]
};

export class InfoController {
    constructor(private service: IInfoService) {}

    public apiMap = (_req: Request, res: Response): void => {
        ok(res, API_MAP);
    };

    public estadisticas = async (_req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.service.estadisticas());
        } catch (e) { err(res, e); }
    };

    public health = async (_req: Request, res: Response): Promise<void> => {
        try {
            ok(res, await this.service.health());
        } catch (e) { err(res, e); }
    };

    public getCatalogos = async (_req: Request, res: Response): Promise<void> => {
        try {
            const catalogos = CacheService.getInstance().getCatalogos();
            ok(res, catalogos);
        } catch (e) { err(res, e); }
    };
}
