/**
 * build-endpoints-md.js — Genera el MAPA de endpoints del PAGO DE MATERIAL en Markdown.
 *
 * Misma fuente de verdad que build-postman.js: API_MAP en
 * src/controllers/info/info.controller.ts. Filtra SOLO lo del pago de material
 * (grupo 'Pago Material' del módulo pagos + módulo 'flujo_pago_material') y emite
 * MAPA-ENDPOINTS.md con una intro del modelo + los endpoints (método, ruta,
 * descripción, query, body, response). Re-ejecuta al cambiar esos endpoints:
 *
 *   node scripts/build-endpoints-md.js
 */
const fs = require('fs');
const path = require('path');

const INFO_FILE = path.join('src', 'controllers', 'info', 'info.controller.ts');
const OUT_FILE = 'MAPA-ENDPOINTS.md';

// Alcance: qué incluir. `null` en grupos = todos los grupos de ese módulo.
const INCLUIR = [
  { modulo: 'pagos', grupos: ['Pago Material'] },
  { modulo: 'flujo_pago_material', grupos: null },
];

// --- Extraer API_MAP del .ts (igual que build-postman.js) ---
function extractApiMap(src) {
  const marker = 'export const API_MAP';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('No se encontro API_MAP en ' + INFO_FILE);
  const braceStart = src.indexOf('{', start);
  let depth = 0, inStr = null;
  for (let k = braceStart; k < src.length; k++) {
    const ch = src[k];
    if (inStr) {
      if (ch === '\\') { k++; continue; }
      if (ch === inStr) { inStr = null; continue; }
      if (inStr === '`' && ch === '$' && src[k + 1] === '{') {
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
  throw new Error('No se pudo balancear API_MAP');
}

const src = fs.readFileSync(INFO_FILE, 'utf8');
const API_MAP = new Function('CONFIG', 'return (' + extractApiMap(src) + ');')({ serverPort: 3005 });

// Filtrar módulos/grupos según INCLUIR, conservando el orden de INCLUIR.
const modulos = [];
for (const inc of INCLUIR) {
  const mod = (API_MAP.modulos || []).find(m => m.nombre === inc.modulo);
  if (!mod) continue;
  const eps = (mod.endpoints || []).filter(e => !inc.grupos || inc.grupos.includes(e.grupo || 'General'));
  if (eps.length) modulos.push({ ...mod, endpoints: eps });
}

// --- Markdown ---
const L = [];
const fecha = new Date().toISOString().slice(0, 10);
const totalEndpoints = modulos.reduce((n, m) => n + m.endpoints.length, 0);

L.push('# Mapa de endpoints — Pago de MATERIAL (agrupado por minero + abonos)');
L.push('');
L.push('> GENERADO desde `/info` (API_MAP) por `scripts/build-endpoints-md.js`.');
L.push('> Solo cubre el **pago de material**. Al cambiar esos endpoints, re-ejecuta el script.');
L.push(`> Fecha: ${fecha} · ${totalEndpoints} endpoints.`);
L.push('');
L.push('**Base URL:** `http://localhost:3005/api/v1` · Auth: `Authorization: Bearer <token>` (login en `/auth/login`).');
L.push('');

// Intro curada del modelo (cómo funciona)
L.push('## Cómo funciona (modelo)');
L.push('');
L.push('Se agrupan **varias volquetas del mismo minero** en **una sola cuenta por pagar** (`Cuentas_Por_Pagar`)');
L.push('y se le hacen **muchos abonos** (`Abonos_CxP`) a lo largo del tiempo hasta cubrir el total.');
L.push('');
L.push('```');
L.push('Cuentas_Por_Pagar (1)  ── valor_total = Σ precio_total de las volquetas (precio del material SIN gastos)');
L.push('   ├── Cuentas_Por_Pagar_Relacion (N)  ── 1 por volqueta (id_entrada, subtipo="material", monto_aplicado)');
L.push('   └── Abonos_CxP (N)                  ── 1 por transferencia (valor, fecha, metodo, comprobante_url)');
L.push('```');
L.push('');
L.push('- **valor de cada volqueta** = `material_planta_entrada.precio_total` (precio del material, sin gastos).');
L.push('- El **minero** se DERIVA de las entradas; una cuenta = un solo minero.');
L.push('- **Estado y saldo** de la cuenta (`pendiente/parcial/pagado`) se **recalculan solos** tras cada abono');
L.push('  o edición (no hay trigger; lo hace el service).');
L.push('- **Prorrateo:** cada volqueta se paga en el mismo % que el grupo →');
L.push('  `pagado_volqueta = monto_aplicado × (valor_pagado / valor_total)`.');
L.push('- **Comprobante OBLIGATORIO** por abono (`comprobante_url`).');
L.push('- El detalle (`GET /material/:id`) trae por volqueta: peso húmedo/seco, humedad, tenor, gramos de oro,');
L.push('  método de precio (por_gramo/por_tonelada), precio unitario, valor del material y su **análisis** anidado.');
L.push('');
L.push('**Reglas / validaciones:** mismo minero por cuenta · no duplicar una entrada en dos cuentas ·');
L.push('no agrupar entradas sin precio (`precio_total = 0`) · abono ≤ saldo · al quitar volquetas el total');
L.push('no baja de lo ya abonado · anular bloqueado si la cuenta tiene abonos · `saldo_a_favor` aún no soportado.');
L.push('');
L.push('**Estados (verdad del pago):** (1) `Cuentas_Por_Pagar.estado` = el lote (lo mantiene el service);');
L.push('(2) `v_estado_pago_material` = por entrada, prorrateada (la usa el módulo de deudas — correr');
L.push('`fix_v_estado_pago_material_prorrateo_2026-08-31.sql`); (3) `material_planta_entrada.estado=\'pagada\'`');
L.push('es un campo MANUAL que NO se sincroniza con los abonos → no usarlo como verdad del pago.');
L.push('');
L.push('Docs de fondo: `ABONOS_material_agrupado_2026-08-31.md`.');
L.push('');
L.push('---');
L.push('');

for (const mod of modulos) {
  const titulo = mod.nombre === 'flujo_pago_material' ? 'Flujo de prueba (paso a paso)' : `Endpoints (${mod.nombre})`;
  L.push(`## ${titulo}`);
  L.push('');
  L.push(`Prefijo: \`${mod.prefijo}\`${mod.requiere_token ? ' · **Requiere token**' : ''}`);
  L.push('');

  const grupos = new Map();
  for (const ep of mod.endpoints) {
    const g = ep.grupo || 'General';
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(ep);
  }

  for (const [grupo, eps] of grupos) {
    if (mod.nombre !== 'pagos') { L.push(`### ${grupo}`); L.push(''); }
    for (const ep of eps) {
      const ruta = (mod.prefijo + ep.ruta).replace(/\/+/g, '/');
      L.push(`- **\`${ep.metodo}\`** \`${ruta}\` — ${ep.descripcion || ''}`);
      if (ep.params && Object.keys(ep.params).length) {
        L.push(`  - Query: \`${Object.entries(ep.params).map(([k, v]) => `${k}=${v}`).join(' & ')}\``);
      }
      if (ep.body !== undefined) {
        L.push('  - Body:');
        L.push('    ```json');
        for (const ln of JSON.stringify(ep.body, null, 2).split('\n')) L.push('    ' + ln);
        L.push('    ```');
      }
    }
    L.push('');
  }
  L.push('---');
  L.push('');
}

fs.writeFileSync(OUT_FILE, L.join('\n'), 'utf8');
console.log(`OK -> ${OUT_FILE} (solo pago material · ${totalEndpoints} endpoints)`);
