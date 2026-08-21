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
