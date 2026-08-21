// Agrega/actualiza en las colecciones Postman el CRUD dedicado de Tarifa_Zona
// y el CRUD referencial de Precio_Material (rutas bajo /material/mina).
const fs = require('fs');
const path = require('path');

const FILES = [
  'Molinos_Flujo_2.0_Postman_Collection.json',
  'Molinos - Flujo 2.0 (Volquetas - Entradas - Analisis) Copy.postman_collection.json',
];

const jsonHeader = [{ key: 'Content-Type', value: 'application/json' }];

// Helper para armar un request Postman. path = array de segmentos tras {{base_url}}.
function req(name, method, segments, description, bodyObj, event) {
  const r = {
    name,
    request: {
      method,
      header: jsonHeader,
      url: {
        raw: '{{base_url}}/' + segments.join('/'),
        host: ['{{base_url}}'],
        path: segments,
      },
      description: description || '',
    },
    response: [],
  };
  if (bodyObj !== undefined) {
    r.request.body = {
      mode: 'raw',
      raw: JSON.stringify(bodyObj, null, 2),
      options: { raw: { language: 'json' } },
    };
  }
  if (event) r.event = event;
  return r;
}

// Test script que captura data.id en una collection variable.
function captureId(varName) {
  return [{
    listen: 'test',
    script: {
      type: 'text/javascript',
      exec: [
        "pm.test('ok (200/201)', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));",
        'const j = pm.response.json();',
        'const id = j && j.data && j.data.id;',
        `if (id) { pm.collectionVariables.set('${varName}', id); console.log('${varName} =', id); }`,
      ],
    },
  }];
}

// ---- Folder Tarifa_Zona (CRUD dedicado) ----
function tarifaZonaFolder() {
  const base = ['material', 'mina', 'tarifa-zona'];
  const byId = ['material', 'mina', 'tarifa-zona', '{{id_tarifa_zona}}'];
  return {
    name: '2. Tarifas de flete por zona',
    description:
      'CRUD DEDICADO de Tarifa_Zona (rutas /material/mina/tarifa-zona). ' +
      'valor_tonelada = flete por tonelada de la zona (alias aceptado: tarifa). ' +
      'El flete por entrada (costo_volqueta = peso x valor_tonelada) se calcula en Node al editar la entrada ' +
      '(PUT /material/entradas/:id) o se fija a mano con PATCH /material/entradas/:id/gastos-operativos. ' +
      'Al crear una tarifa activa se cierra la vigente de esa zona (una activa por zona).',
    item: [
      req('GET tarifas de zona (con historial)', 'GET', base,
        'Lista todas las tarifas (activas e historicas) con el nombre de la zona.'),
      req('GET tarifa por id', 'GET', byId, 'Detalle de una tarifa por id.'),
      req('POST crear tarifa de zona', 'POST', base,
        'Crea una tarifa. Requiere id_zona y valor_tonelada. Si entra activa, versiona la vigente de la zona. vigente_desde es opcional (por defecto hoy).',
        { id_zona: 1, valor_tonelada: 130000, vigente_desde: null, activo: true },
        captureId('id_tarifa_zona')),
      req('PUT editar tarifa de zona', 'PUT', byId,
        'Edita campos de la tarifa (valor_tonelada/tarifa, vigencias, activo).',
        { valor_tonelada: 140000, activo: true }),
      req('DELETE tarifa de zona', 'DELETE', byId, 'Elimina fisicamente la tarifa por id.'),
    ],
  };
}

// ---- Folder Precio_Material (CRUD referencial) ----
function precioMaterialFolder() {
  const base = ['material', 'mina', 'precio-material'];
  const byId = ['material', 'mina', 'precio-material', '{{id_precio_material}}'];
  return {
    name: '7. Precio_Material (CRUD referencial)',
    description:
      'CRUD BASICO/REFERENCIAL de Precio_Material (rutas /material/mina/precio-material). ' +
      'Tabla de escala de precios de compra por rango de tenor. NO esta enganchada a ningun calculo del flujo actual ' +
      '(el precio hoy es manual, Fase 3). Es solo administracion/consulta de la tabla de referencia.',
    item: [
      req('GET precios de material', 'GET', base,
        'Lista los precios con nombres de minero/zona resueltos.'),
      req('GET precio por id', 'GET', byId, 'Detalle de un precio por id.'),
      req('POST crear precio de material', 'POST', base,
        'Crea un registro de precio de referencia. metodo: por_gramo | por_tonelada.',
        {
          id_minero: null,
          id_zona: null,
          metodo: 'por_tonelada',
          precio_por_gramo: null,
          precio_por_tonelada: 650000,
          intervalo_tenor_min: 0,
          intervalo_tenor_max: 9999,
          fecha_inicio: '2026-08-01',
          fecha_fin: null,
          activo: true,
        },
        captureId('id_precio_material')),
      req('PUT editar precio de material', 'PUT', byId,
        'Edita solo los campos enviados.',
        { precio_por_tonelada: 700000, activo: true }),
      req('DELETE precio de material', 'DELETE', byId, 'Elimina fisicamente el precio por id.'),
    ],
  };
}

function ensureVar(coll, key) {
  coll.variable = coll.variable || [];
  if (!coll.variable.some((v) => v.key === key)) {
    coll.variable.push({ key, value: '', type: 'string' });
  }
}

for (const file of FILES) {
  const full = path.join(process.cwd(), file);
  const coll = JSON.parse(fs.readFileSync(full, 'utf8'));

  const catalogos = (coll.item || []).find((i) => /Catalogo/i.test(i.name));
  if (!catalogos) {
    console.log('!! No se encontro folder Catalogos en', file);
    continue;
  }
  catalogos.item = catalogos.item || [];

  // 1) Reemplazar el folder de Tarifas de flete por zona por el CRUD dedicado.
  const tz = tarifaZonaFolder();
  const idxTz = catalogos.item.findIndex((i) => /Tarifas de flete por zona/i.test(i.name));
  if (idxTz >= 0) catalogos.item[idxTz] = tz;
  else catalogos.item.push(tz);

  // 2) Agregar/actualizar el folder referencial de Precio_Material.
  const pm = precioMaterialFolder();
  const idxPm = catalogos.item.findIndex((i) => /Precio_Material \(CRUD referencial\)/i.test(i.name));
  if (idxPm >= 0) catalogos.item[idxPm] = pm;
  else catalogos.item.push(pm);

  ensureVar(coll, 'id_tarifa_zona');
  ensureVar(coll, 'id_precio_material');

  fs.writeFileSync(full, JSON.stringify(coll, null, 2) + '\n', 'utf8');
  console.log('OK ->', file);
}
