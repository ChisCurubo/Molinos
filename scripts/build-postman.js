/**
 * build-postman.js — Generador UNIFICADO de la coleccion Postman.
 *
 * Fuente de verdad: el mapa de la API que sirve /info (API_MAP en
 * src/controllers/info/info.controller.ts). Este script lo lee y genera un
 * unico .json con TODOS los endpoints, organizados en carpetas aisladas:
 *   modulo (auth, material, pagos, nomina, info, flujo_completo)
 *     └── grupo (Entradas MPE, Tarifa Zona, Precio Material, Vistas, ...)
 *           └── request
 *
 * Uso:  node scripts/build-postman.js
 * Salida: Molinos_API_Postman_Collection.json (unificada)
 *
 * Al agregar/editar endpoints en API_MAP (/info), vuelve a correr este script
 * y la coleccion queda sincronizada. "Todo se actualiza desde /info".
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INFO_FILE = path.join('src', 'controllers', 'info', 'info.controller.ts');
const OUT_FILE = 'Molinos_API_Postman_Collection.json';
const API_PREFIX = '/api/v1'; // el {{base_url}} ya incluye este prefijo
const DEFAULT_BASE_URL = 'http://localhost:3005/api/v1';

// --- 1) Extraer el objeto API_MAP del .ts (sin ejecutar todo el archivo) ---
// Escanea saltando strings/plantillas para contar solo las llaves del objeto.
function extractApiMap(src) {
  const marker = 'export const API_MAP';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('No se encontro API_MAP en ' + INFO_FILE);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let inStr = null; // comilla actual: ' " `
  for (let k = braceStart; k < src.length; k++) {
    const ch = src[k];
    if (inStr) {
      if (ch === '\\') { k++; continue; }
      if (ch === inStr) { inStr = null; continue; }
      if (inStr === '`' && ch === '$' && src[k + 1] === '{') {
        // expresion de plantilla ${...}: saltar hasta su } balanceado
        k += 2; let d = 1;
        while (k < src.length && d > 0) { if (src[k] === '{') d++; else if (src[k] === '}') d--; k++; }
        k--;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(braceStart, k + 1); }
  }
  throw new Error('No se pudo balancear el objeto API_MAP');
}

const src = fs.readFileSync(INFO_FILE, 'utf8');
const objText = extractApiMap(src);
// eslint-disable-next-line no-new-func
const API_MAP = new Function('CONFIG', 'return (' + objText + ');')({ serverPort: 3005 });

// --- 2) Helpers para armar requests Postman ---
function pathSegments(prefijo, ruta) {
  let p = (prefijo + ruta).replace(/\/+/g, '/');
  if (p.startsWith(API_PREFIX)) p = p.slice(API_PREFIX.length);
  return p.split('/').filter(Boolean); // conserva :params como segmentos literales
}

function loginEvent() {
  return [{
    listen: 'test',
    script: {
      type: 'text/javascript',
      exec: [
        'const j = pm.response.json();',
        "const tk = (j && j.data && (j.data.token || j.data.accessToken)) || j.token;",
        "if (tk) { pm.collectionVariables.set('token', tk); console.log('token guardado'); }",
        "pm.test('login 200', () => pm.response.to.have.status(200));",
      ],
    },
  }];
}

function buildRequest(ep, prefijo) {
  const segments = pathSegments(prefijo, ep.ruta);
  const isLogin = ep.metodo === 'POST' && /\/login\/?$/.test(ep.ruta);
  const header = [];
  const url = { raw: '{{base_url}}/' + segments.join('/'), host: ['{{base_url}}'], path: segments };

  if (ep.params && Object.keys(ep.params).length) {
    url.query = Object.entries(ep.params).map(([key, value]) => ({ key, value: String(value) }));
    url.raw += '?' + url.query.map((q) => `${q.key}=${encodeURIComponent(q.value)}`).join('&');
  }

  const request = { method: ep.metodo, header, url, description: ep.descripcion || '' };

  if (ep.body !== undefined) {
    header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = { mode: 'raw', raw: JSON.stringify(ep.body, null, 2), options: { raw: { language: 'json' } } };
  }

  const item = { name: `${ep.metodo} ${ep.ruta}`, request, response: [] };

  if (isLogin) {
    request.auth = { type: 'noauth' };
    item.event = loginEvent();
  }
  return item;
}

// Agrupa los endpoints de un modulo en carpetas aisladas por `grupo` (en orden de aparicion).
function groupFolders(endpoints, prefijo) {
  const folders = new Map();
  for (const ep of endpoints) {
    const g = ep.grupo || 'General';
    if (!folders.has(g)) folders.set(g, { name: g, item: [] });
    folders.get(g).item.push(buildRequest(ep, prefijo));
  }
  return Array.from(folders.values());
}

// --- 3) Construir la coleccion ---
const collection = {
  info: {
    _postman_id: crypto.randomUUID(),
    name: `${API_MAP.nombre} (unificada) v${API_MAP.version}`,
    description:
      `${API_MAP.descripcion}\n\nGENERADA automaticamente desde /info (API_MAP) por scripts/build-postman.js.\n` +
      'No editar a mano: al cambiar endpoints en info.controller.ts, re-ejecuta el script.\n' +
      `Configura la variable base_url (por defecto ${DEFAULT_BASE_URL}). El login auto-guarda {{token}}; ` +
      'el resto hereda Bearer {{token}} a nivel de coleccion.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'base_url', value: DEFAULT_BASE_URL, type: 'string' },
    { key: 'token', value: '', type: 'string' },
  ],
  item: (API_MAP.modulos || []).map((mod) => ({
    name: `${mod.nombre}${mod.prefijo ? '  (' + mod.prefijo + ')' : ''}`,
    description: mod.requiere_token ? 'Requiere token (Bearer heredado).' : '',
    item: groupFolders(mod.endpoints || [], mod.prefijo || ''),
  })),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(collection, null, 2) + '\n', 'utf8');

// --- 4) Resumen ---
const totalEndpoints = (API_MAP.modulos || []).reduce((n, m) => n + (m.endpoints || []).length, 0);
const totalFolders = collection.item.reduce((n, m) => n + m.item.length, 0);
console.log(`OK -> ${OUT_FILE}`);
console.log(`Modulos: ${collection.item.length} | Carpetas (grupos): ${totalFolders} | Endpoints: ${totalEndpoints}`);
for (const m of collection.item) {
  console.log(`  [${m.name}] -> ${m.item.map((f) => f.name + '(' + f.item.length + ')').join(', ')}`);
}
