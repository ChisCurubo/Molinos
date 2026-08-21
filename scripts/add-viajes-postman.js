/**
 * Añade a la colección Postman existente las carpetas:
 *   6 - Procesamiento (concentrado)
 *   7 - Viajes / Despachos
 *   8 - Agua Planta
 *   9 - Flujo COMPLETO (Concentrado -> Viaje)
 * Preserva todo lo que ya existe. Idempotente: reemplaza esas carpetas si ya estaban.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'Molinos - Flujo 2.0 (Volquetas - Entradas - Analisis) Copy.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// ---- helpers -------------------------------------------------------------
const json = (obj) => JSON.stringify(obj, null, 2);

function req(method, ruta, { body, query, desc } = {}) {
    const pathArr = ruta.split('/').filter(Boolean);
    const url = { raw: `{{base_url}}/${ruta}`, host: ['{{base_url}}'], path: pathArr };
    if (query) url.query = Object.entries(query).map(([key, value]) => ({ key, value: String(value) }));
    const request = { method, header: [], url };
    if (desc) request.description = desc;
    if (body) {
        request.header.push({ key: 'Content-Type', value: 'application/json' });
        request.body = { mode: 'raw', raw: json(body), options: { raw: { language: 'json' } } };
    }
    return request;
}

function item(name, request, testExec) {
    const it = { name, request, response: [] };
    if (testExec) {
        it.event = [{ listen: 'test', script: { type: 'text/javascript', exec: testExec } }];
    }
    return it;
}

function folder(name, items) {
    return { name, item: items };
}

// ---- 6. Procesamiento (concentrado) --------------------------------------
const carpetaProcesamiento = folder('6 - Procesamiento (concentrado)', [
    item('GET listar lotes (todos los estados)',
        req('GET', 'material/concentrado', {
            desc: 'Lista lotes de TODOS los estados con filtros (todos opcionales): codigo, estado, desde, hasta, limit, offset. Incluye material_seco_procesado, maquila_total, num_materiales y el tenor del analisis (au/ag por ton y gramos totales).',
            query: { estado: '', limit: '100' }
        })),
    item('GET resumen de procesamiento (KPIs)',
        req('GET', 'material/concentrado/resumen', {
            desc: 'Conteo de lotes por estado (en_proceso/en_canoa/parcialmente_enviado/enviado_completo) + toneladas_disponibles_total.'
        })),
    item('GET materiales procesados (lista plana)',
        req('GET', 'material/concentrado/procesamiento', {
            desc: 'Lista plana de materiales vinculados a lotes, con analisis embebidos. Filtros: id_lote, codigo_lote, id_mina, desde, hasta, estado_lote.',
            query: { estado_lote: '' }
        })),
    item('GET detalle de lote (+materiales +analisis)',
        req('GET', 'material/concentrado/{{id_lote_concentrado}}', {
            desc: 'Detalle del lote + materiales vinculados + analisis del concentrado.'
        })),
    item('GET analisis del concentrado del lote',
        req('GET', 'material/analisis/concentrado/{{id_lote_concentrado}}', {
            desc: 'Analisis del concentrado de un lote (tenor real): au_gr_x_ton, ag_gr_x_ton, au/ag_concentrado, toneladas_secas.'
        })),
    item('POST iniciar lote de concentrado',
        req('POST', 'material/concentrado', {
            desc: 'Abre un lote (material_concentrado) en estado en_proceso.',
            body: { codigo: 'LOTE-001', fecha_inicio: '2026-08-01' }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('lote iniciado (201)', () => pm.response.to.have.status(201));",
            "if (j.id) { pm.collectionVariables.set('id_lote_concentrado', j.id); }"
        ]),
    item('POST procesar material (agregar entradas al molino)',
        req('POST', 'material/concentrado/{{id_lote_concentrado}}/procesar', {
            desc: 'Distribuye toneladas_procesadas_seco proporcionalmente entre las entradas indicadas. Body: id_entradas es un ARREGLO.',
            body: { id_entradas: ['{{id_entrada}}'], toneladas_procesadas_seco: 8.5 }
        }),
        [
            "pm.test('material procesado (201)', () => pm.response.to.have.status(201));"
        ]),
    item('PUT cerrar lote (enviar a canoa, calcula maquila)',
        req('PUT', 'material/concentrado/{{id_lote_concentrado}}/cerrar', {
            desc: 'Cierra el lote, calcula el seco, la maquila y crea el Inventario_Lote del concentrado.',
            body: {
                toneladas_humedo: 5,
                porcentaje_humedad: 0.1,
                fecha_fin: '2026-08-05',
                hizo_molienda: 1,
                hizo_flotacion: 0,
                hizo_relave: 0,
                hizo_filtroprensa: 1,
                ubicacion_canoa: 'Canoa 1'
            }
        }),
        [
            "pm.test('lote cerrado (200)', () => pm.response.to.have.status(200));"
        ]),
    item('POST analisis del concentrado (DESPUES de cerrar)',
        req('POST', 'material/analisis', {
            desc: 'Analisis del CONCENTRADO del lote. Solo requiere: id_material_concentrado, numero_analisis, porcentaje_humedad, au_concentrado, ag_concentrado. La tonelada base (toneladas_seco) y los tenores (au_gr_x_ton, ag_gr_x_ton) los calcula el backend sobre el lote. id_tipo_analisis=2 se asume.',
            body: { id_material_concentrado: '{{id_lote_concentrado}}', numero_analisis: 'AN-LOTE-001', porcentaje_humedad: 0.1, au_concentrado: 120, ag_concentrado: 500 }
        }),
        [
            "pm.test('analisis concentrado (201)', () => pm.response.to.have.status(201));"
        ]),
    item('PUT editar lote',
        req('PUT', 'material/concentrado/{{id_lote_concentrado}}', {
            desc: 'Editar codigo/procesos/ubicacion/precio_maquila del lote.',
            body: { codigo: 'LOTE-001B', comentarios: 'Editado' }
        })),
    item('DELETE desvincular material del lote',
        req('DELETE', 'material/concentrado/{{id_lote_concentrado}}/material/{{id_entrada}}', {
            desc: 'Quita una entrada del lote en_proceso y devuelve su stock.'
        })),
    item('DELETE eliminar lote (solo en_proceso)',
        req('DELETE', 'material/concentrado/{{id_lote_concentrado}}', {
            desc: 'Devuelve todo el material, borra analisis del lote y el lote. 409 si cerrado o en viajes.'
        })),
]);

// ---- 6b. Inventario (vistas consolidadas) --------------------------------
const carpetaInventario = folder('6b - Inventario (crudo / concentrado)', [
    item('GET resumen de inventario (KPIs)',
        req('GET', 'material/inventario/resumen', {
            desc: 'KPIs de inventario calculados de tablas base: entradas_sin_lote, crudo_humedo/seco_total, lotes_en_canoa, concentrado_humedo_disponible, concentrado_maquila_total.'
        })),
    item('GET material crudo (pendiente de procesar)',
        req('GET', 'material/inventario/crudo', {
            desc: 'Entradas pendiente/pagada aun no procesadas del todo (vista v_inventario_material_crudo).'
        })),
    item('GET concentrado disponible (para despachar)',
        req('GET', 'material/inventario/concentrado', {
            desc: 'Lotes en_canoa/parcial con toneladas_disponibles > 0 (vista v_inventario_concentrado).'
        })),
    item('GET resumen de un lote',
        req('GET', 'material/inventario/lote/{{id_lote_concentrado}}', {
            desc: 'Resumen/KPIs de un lote (vista v_resumen_lote).'
        })),
]);

// ---- 7. Viajes / Despachos ----------------------------------------------
const carpetaViajes = folder('7 - Viajes / Despachos', [
    item('GET listar viajes (filtros + lineas + agregados)',
        req('GET', 'material/viajes', {
            desc: 'Lista viajes con filtros (todos opcionales): desde, hasta, numero_viaje, id_lote, codigo_lote, limit, offset. Cada viaje trae sus lineas embebidas y agregados (humedo, seco, maquila, valor, au/ag gramos).',
            query: { desde: '2026-01-01', hasta: '2026-12-31' }
        })),
    item('GET detalle de viaje',
        req('GET', 'material/viajes/{{id_viaje}}', {
            desc: 'Detalle de un viaje con sus lineas completas + agregados. Se usa al abrir el modal de edicion.'
        })),
    item('GET resumen de viajes (KPIs)',
        req('GET', 'material/viajes/resumen', {
            desc: 'KPIs del periodo: total_viajes, toneladas_humedo/seco, maquila_total, valor_material_total, au/ag_gramos_total + promedios por viaje.',
            query: { desde: '2026-01-01', hasta: '2026-12-31' }
        })),
    item('GET trazabilidad de un lote en viajes',
        req('GET', 'material/viajes/lote/{{id_lote_concentrado}}', {
            desc: 'En que viajes salio un lote y cuanto metal llevo (id_viaje, numero_viaje, fecha, humedo/seco, au/ag gramos).'
        })),
    item('GET trazabilidad completa del viaje (viaje -> lotes -> materiales)',
        req('GET', 'material/viajes/{{id_viaje}}/trazabilidad', {
            desc: 'Doy un id de viaje: devuelve sus lineas (lotes) y, por cada lote, los materiales de origen (mina/minero, numero_volqueta, toneladas aportadas/seco, concentrado_proporcional, maquila_proporcional, porcentaje_aporte).'
        })),
    item('GET trazabilidad de una linea (linea -> lote -> materiales)',
        req('GET', 'material/viajes/linea/{{id_linea_viaje}}/trazabilidad', {
            desc: 'Desde una linea de viaje: su lote y los materiales que compusieron ese concentrado, con cuanto aporto cada uno.'
        })),
    item('POST crear cabecera de viaje',
        req('POST', 'material/viajes', {
            desc: 'Crea la cabecera del viaje (tabla Viaje).',
            body: { numero_viaje: '13-1', fecha: '2026-08-10', comentarios: 'Viaje 13-1' }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('viaje creado (201)', () => pm.response.to.have.status(201));",
            "if (j.id) { pm.collectionVariables.set('id_viaje', j.id); }"
        ]),
    item('POST agregar lote al viaje (solo id + cantidad opcional)',
        req('POST', 'material/viajes/{{id_viaje}}/lineas', {
            desc: 'Selecciona el lote y el backend DERIVA todo (humedad, seco, peso_humedad, tenores, gramos) del lote y su analisis. Solo puedes enviar total_concentrado_humedo (cuanto despachar; si se omite, va TODO lo disponible) y opcionalmente valor_total y concepto. El trigger de BD descuenta el stock y fija el costo_maquila.',
            body: {
                id_material_concentrado: '{{id_lote_concentrado}}',
                total_concentrado_humedo: 5,
                valor_total: 0
            }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('linea asignada (201)', () => pm.response.to.have.status(201));",
            "if (j.id) { pm.collectionVariables.set('id_linea_viaje', j.id); }"
        ]),
    item('DELETE eliminar linea del viaje (devuelve stock)',
        req('DELETE', 'material/viajes/{{id_viaje}}/lineas/{{id_linea_viaje}}', {
            desc: 'Elimina la linea; el trigger de BD devuelve el stock al lote.'
        }),
        [
            "pm.test('linea eliminada (200)', () => pm.response.to.have.status(200));"
        ]),
    item('DELETE eliminar viaje completo',
        req('DELETE', 'material/viajes/{{id_viaje}}', {
            desc: 'Borra todas las lineas (devuelve stock) y la cabecera del viaje.'
        })),
]);

// ---- 8. Agua Planta ------------------------------------------------------
const carpetaAgua = folder('8 - Agua Planta', [
    item('POST registrar viaje de agua',
        req('POST', 'material/agua', {
            desc: 'Registra un viaje de abastecimiento de agua.',
            body: { id_vehiculo: '{{id_vehiculo}}', fecha: '2026-08-03', valor_viaje: 50000, cantidad_viajes: 1, acpm: 0, comprobante_url: 'https://ejemplo.com/recibo.png' }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('agua registrada (201)', () => pm.response.to.have.status(201));",
            "const id = j && j.data && j.data.id;",
            "if (id) { pm.collectionVariables.set('id_agua', id); }"
        ]),
    item('PUT actualizar viaje de agua',
        req('PUT', 'material/agua/{{id_agua}}', {
            desc: 'Actualiza y recalcula el valor total. Todos los campos son opcionales.',
            body: { valor_viaje: 60000, cantidad_viajes: 2, acpm: 10000, comprobante_url: 'https://ejemplo.com/nuevo_recibo.png' }
        }),
        [
            "pm.test('agua actualizada (200)', () => pm.response.to.have.status(200));"
        ]),
    item('GET listar viajes de agua',
        req('GET', 'material/agua/viajes', {
            desc: 'Lista los viajes de agua en el rango de fechas.',
            query: { desde: '2026-01-01', hasta: '2026-12-31' }
        })),
    item('GET resumen por dueno',
        req('GET', 'material/agua/resumen', {
            desc: 'Totales de viajes y dinero adeudado agrupado por dueno.',
            query: { desde: '2026-01-01', hasta: '2026-12-31' }
        })),
    item('GET viajes de agua por dueno',
        req('GET', 'material/agua/dueno/{{id_dueno}}', {
            desc: 'Resumen total + lista de viajes de un dueno especifico.'
        })),
    item('GET reporte mensual (agrupado por dueno + saldo)',
        req('GET', 'material/agua/reporte-mensual', {
            desc: 'Agrupa los viajes del periodo por dueno. Cada dueno trae sus viajes + resumen (bruto, acpm, neto_mes, saldo_inicio, abonado=0, saldo_fin). Acepta mes+anio o desde+hasta.',
            query: { mes: 8, anio: 2026 }
        })),
    item('GET viaje de agua por ID',
        req('GET', 'material/agua/{{id_agua}}', {
            desc: 'Detalle de un viaje de agua especifico.'
        })),
]);

// ---- 9. FLUJO MATERIAL (paso a paso, por fases) --------------------------
// Cada fase es una subcarpeta con crear / editar / eliminar.
const faseLote = folder('Fase 1 · Lote de concentrado', [
    item('1. Crear lote',
        req('POST', 'material/concentrado', {
            desc: 'Procesos (molienda/flotacion/relave/filtroprensa) por ahora se declaran al CERRAR; comentados en la creacion.',
            body: { codigo: 'LOTE-FLUJO-1', fecha_inicio: '2026-08-01' }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('lote iniciado (201)', () => pm.response.to.have.status(201));",
            "if (j.id) { pm.collectionVariables.set('flujo3_lote_id', j.id); }"
        ]),
    item('Editar lote (codigo, procesos, ubicacion...)',
        req('PUT', 'material/concentrado/{{flujo3_lote_id}}', {
            desc: 'Whitelist: codigo, fecha_inicio, comentarios, hizo_molienda/flotacion/relave/filtroprensa, ubicacion_canoa, precio_maquila_por_ton. No toca estado ni toneladas.',
            body: { codigo: 'LOTE-FLUJO-1B', comentarios: 'Editado' }
        })),
    item('Eliminar lote — "este lote no va" (solo en_proceso)',
        req('DELETE', 'material/concentrado/{{flujo3_lote_id}}', {
            desc: 'Devuelve TODO el material al inventario, borra sus analisis y el lote. 409 si el lote ya se cerro o esta en viajes.'
        })),
]);

const faseProcesar = folder('Fase 2 · Procesar material', [
    item('2. Procesar material (seleccionar entradas + cuanto seco)',
        req('POST', 'material/concentrado/{{flujo3_lote_id}}/procesar', {
            desc: 'id_entradas es un ARREGLO (puedes mandar varios). toneladas_procesadas_seco = cuanto del total seco seleccionado vas a procesar.',
            body: { id_entradas: ['{{id_entrada}}'], toneladas_procesadas_seco: 5 }
        }),
        [
            "pm.test('material procesado (201)', () => pm.response.to.have.status(201));"
        ]),
    item('Desvincular material del lote (devuelve stock)',
        req('DELETE', 'material/concentrado/{{flujo3_lote_id}}/material/{{id_entrada}}', {
            desc: 'Quita una entrada del lote (solo si el lote esta en_proceso) y le devuelve su stock al inventario de material crudo.'
        })),
]);

const faseCerrar = folder('Fase 3 · Cerrar lote (cuanto concentrado salio)', [
    item('3. Cerrar lote (a canoa)',
        req('PUT', 'material/concentrado/{{flujo3_lote_id}}/cerrar', {
            desc: 'Aqui declaras el total de concentrado que salio (toneladas_humedo) y los procesos aplicados. Calcula seco, maquila e Inventario_Lote.',
            body: { toneladas_humedo: 5, porcentaje_humedad: 0.1, fecha_fin: '2026-08-05', hizo_molienda: 1, hizo_flotacion: 0, hizo_relave: 0, hizo_filtroprensa: 1, ubicacion_canoa: 'Canoa 1' }
        }),
        [
            "pm.test('lote cerrado (200)', () => pm.response.to.have.status(200));"
        ]),
]);

const faseAnalisis = folder('Fase 4 · Analisis del concentrado (del lote)', [
    item('4. Crear analisis del lote (humedad + au + ag + nombre)',
        req('POST', 'material/analisis', {
            desc: 'Se hace DESPUES de cerrar. Solo: id_material_concentrado, numero_analisis, porcentaje_humedad, au_concentrado, ag_concentrado. El backend calcula toneladas_seco y tenores sobre el lote. id_tipo_analisis=2 implicito.',
            body: { id_material_concentrado: '{{flujo3_lote_id}}', numero_analisis: 'AN-LOTE-FLUJO-1', porcentaje_humedad: 0.1, au_concentrado: 120, ag_concentrado: 500 }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('analisis lote (201)', () => pm.response.to.have.status(201));",
            "if (j.id) { pm.collectionVariables.set('flujo3_analisis_lote_id', j.id); }"
        ]),
    item('Editar analisis del lote',
        req('PUT', 'material/analisis/{{flujo3_analisis_lote_id}}', {
            desc: 'Corrige humedad / au / ag del analisis del lote.',
            body: { id_material_concentrado: '{{flujo3_lote_id}}', porcentaje_humedad: 0.12, au_concentrado: 130, ag_concentrado: 520 }
        })),
    item('Eliminar analisis del lote',
        req('DELETE', 'material/analisis/{{flujo3_analisis_lote_id}}')),
]);

const faseViaje = folder('Fase 5 · Viaje', [
    item('5. Crear viaje',
        req('POST', 'material/viajes', {
            body: { numero_viaje: 'FLUJO-1', fecha: '2026-08-10', comentarios: 'Viaje de prueba flujo completo' }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('viaje creado (201)', () => pm.response.to.have.status(201));",
            "if (j.id) { pm.collectionVariables.set('flujo3_viaje_id', j.id); }"
        ]),
    item('Eliminar viaje completo (borra lineas + devuelve stock)',
        req('DELETE', 'material/viajes/{{flujo3_viaje_id}}', {
            desc: 'Borra cada linea (el trigger devuelve el stock a cada lote) y luego la cabecera del viaje.'
        })),
]);

const faseLinea = folder('Fase 6 · Agregar lote(s) al viaje', [
    item('6. Agregar lote al viaje (solo id + cantidad opcional)',
        req('POST', 'material/viajes/{{flujo3_viaje_id}}/lineas', {
            desc: 'Solo seleccionas el lote. El backend deriva humedad, seco, peso_humedad, tenores y gramos del lote + su analisis. total_concentrado_humedo es opcional (si se omite, despacha TODO lo disponible). valor_total y concepto opcionales.',
            body: { id_material_concentrado: '{{flujo3_lote_id}}', total_concentrado_humedo: 5, valor_total: 0 }
        }),
        [
            "const j = pm.response.json();",
            "pm.test('linea asignada (201)', () => pm.response.to.have.status(201));",
            "if (j.id) { pm.collectionVariables.set('flujo3_linea_id', j.id); }"
        ]),
    item('Eliminar linea del viaje (devuelve stock al lote)',
        req('DELETE', 'material/viajes/{{flujo3_viaje_id}}/lineas/{{flujo3_linea_id}}'),
        [
            "pm.test('linea eliminada (200)', () => pm.response.to.have.status(200));"
        ]),
]);

const carpetaFlujo = folder('9 - FLUJO MATERIAL (paso a paso)', [
    faseLote, faseProcesar, faseCerrar, faseAnalisis, faseViaje, faseLinea
]);

// ---- ensamblar -----------------------------------------------------------
const nuevasCarpetas = [carpetaProcesamiento, carpetaInventario, carpetaViajes, carpetaAgua, carpetaFlujo];
const nombresNuevos = new Set(nuevasCarpetas.map(c => c.name));
// nombres usados por versiones anteriores del script (para no dejar duplicados al renombrar)
const nombresLegacy = new Set([
    '6b - Inventario (⚠️ vistas no creadas)',
    '9 - Flujo COMPLETO (Concentrado -> Viaje)'
]);

// quitar versiones previas (idempotencia) y añadir al final
collection.item = collection.item.filter(it => !nombresNuevos.has(it.name) && !nombresLegacy.has(it.name));
collection.item.push(...nuevasCarpetas);

// variables nuevas
const varsNuevas = ['id_lote_concentrado', 'id_viaje', 'id_linea_viaje', 'id_agua', 'flujo3_lote_id', 'flujo3_viaje_id', 'flujo3_linea_id', 'flujo3_analisis_lote_id'];
collection.variable = collection.variable || [];
const existentes = new Set(collection.variable.map(v => v.key));
for (const key of varsNuevas) {
    if (!existentes.has(key)) collection.variable.push({ key, value: '' });
}

fs.writeFileSync(FILE, JSON.stringify(collection, null, 2), 'utf8');
console.log('Coleccion actualizada:', path.basename(FILE));
console.log('Carpetas añadidas:', nuevasCarpetas.map(c => c.name).join(' | '));
