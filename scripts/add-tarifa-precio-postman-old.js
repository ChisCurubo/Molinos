// Sincroniza la coleccion vieja (Molinos ERP v4 API) con el CRUD de Tarifa_Zona
// y el CRUD referencial de Precio_Material, respetando su estilo (auth bearer por request).
const fs = require('fs');
const path = require('path');

const FILE = 'Molinos_Postman_Collection.json';
const bearer = { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] };

function req(name, method, segments, description, bodyObj, event) {
  const hasBody = bodyObj !== undefined;
  const r = {
    name,
    request: {
      method,
      header: hasBody ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: {
        raw: '{{base_url}}/' + segments.join('/'),
        host: ['{{base_url}}'],
        path: segments,
      },
      auth: bearer,
      description: description || '',
    },
    response: [],
  };
  if (hasBody) {
    r.request.body = {
      mode: 'raw',
      raw: JSON.stringify(bodyObj, null, 2),
      options: { raw: { language: 'json' } },
    };
  }
  if (event) r.event = event;
  return r;
}

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

function tarifaZonaFolder() {
  const base = ['material', 'mina', 'tarifa-zona'];
  const byId = ['material', 'mina', 'tarifa-zona', '{{id_tarifa_zona}}'];
  return {
    name: 'Tarifa Zona (flete)',
    description:
      'CRUD dedicado de Tarifa_Zona. valor_tonelada = flete por tonelada de la zona (alias: tarifa). ' +
      'El flete de cada entrada (costo_volqueta = peso x valor_tonelada) se calcula al editar la entrada ' +
      '(PUT /material/entradas/:id). Al crear una tarifa activa se cierra la vigente de esa zona.',
    item: [
      req('GET tarifas de zona (con historial)', 'GET', base, 'Lista tarifas (activas e historicas) con nombre de zona.'),
      req('GET tarifa por id', 'GET', byId, 'Detalle por id.'),
      req('POST crear tarifa de zona', 'POST', base,
        'Requiere id_zona y valor_tonelada. vigente_desde opcional (por defecto hoy).',
        { id_zona: 1, valor_tonelada: 130000, vigente_desde: null, activo: true },
        captureId('id_tarifa_zona')),
      req('PUT editar tarifa de zona', 'PUT', byId, 'Body parcial (valor_tonelada/tarifa, vigencias, activo).',
        { valor_tonelada: 140000, activo: true }),
      req('DELETE tarifa de zona', 'DELETE', byId, 'Elimina la tarifa por id.'),
    ],
  };
}

function precioMaterialFolder() {
  const base = ['material', 'mina', 'precio-material'];
  const byId = ['material', 'mina', 'precio-material', '{{id_precio_material}}'];
  return {
    name: 'Precio Material (referencial)',
    description:
      'CRUD basico/referencial de Precio_Material (escala de precios por rango de tenor). ' +
      'NO esta enganchado a ningun calculo del flujo actual (el precio hoy es manual). Solo administracion/consulta.',
    item: [
      req('GET precios de material', 'GET', base, 'Lista con minero/zona resueltos.'),
      req('GET precio por id', 'GET', byId, 'Detalle por id.'),
      req('POST crear precio de material', 'POST', base, 'metodo: por_gramo | por_tonelada.',
        {
          id_minero: null, id_zona: null, metodo: 'por_tonelada',
          precio_por_gramo: null, precio_por_tonelada: 650000,
          intervalo_tenor_min: 0, intervalo_tenor_max: 9999,
          fecha_inicio: '2026-08-01', fecha_fin: null, activo: true,
        },
        captureId('id_precio_material')),
      req('PUT editar precio de material', 'PUT', byId, 'Body parcial.', { precio_por_tonelada: 700000, activo: true }),
      req('DELETE precio de material', 'DELETE', byId, 'Elimina por id.'),
    ],
  };
}

function ensureVar(coll, key) {
  coll.variable = coll.variable || [];
  if (!coll.variable.some((v) => v.key === key)) coll.variable.push({ key, value: '', type: 'string' });
}

// upsert de subfolder por nombre, insertando despues de un indice de referencia.
function upsertAfter(items, folder, afterName) {
  const idx = items.findIndex((i) => i.name === folder.name);
  if (idx >= 0) { items[idx] = folder; return; }
  const refIdx = items.findIndex((i) => i.name === afterName);
  if (refIdx >= 0) items.splice(refIdx + 1, 0, folder);
  else items.push(folder);
}

const full = path.join(process.cwd(), FILE);
const coll = JSON.parse(fs.readFileSync(full, 'utf8'));
const material = (coll.item || []).find((i) => i.name === 'material');
if (!material) throw new Error('No se encontro el folder material');
material.item = material.item || [];

upsertAfter(material.item, tarifaZonaFolder(), 'Mina');
upsertAfter(material.item, precioMaterialFolder(), 'Precios');

ensureVar(coll, 'id_tarifa_zona');
ensureVar(coll, 'id_precio_material');

fs.writeFileSync(full, JSON.stringify(coll, null, 2) + '\n', 'utf8');
console.log('OK ->', FILE);
