/**
 * Test de endpoints ACPM / Combustible (material + agua) — Fase A.
 * Se autentica solo, prueba GET/POST/PUT/PATCH/DELETE y escribe un reporte .md.
 *
 * Requisitos: server corriendo (npm run dev) + migracion_combustible_acpm_2026-09-02.sql aplicada.
 * Uso:  node tests/acpm.endpoints.test.mjs
 * Config por env (opcional): BASE_URL, LOGIN_USER, LOGIN_PASS.
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3005/api/v1';
const USER = process.env.LOGIN_USER || 'david@molinosdecolombia.com';
const PASS = process.env.LOGIN_PASS || 'molinos2026';

const money = n => (n === null || n === undefined) ? n : Number(n);
const results = [];
const log = (...a) => console.log(...a);
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  log(`  ${cond ? '✅' : '❌'} ${name} ${detail}`);
  return !!cond;
}

let TOKEN = '';
async function req(method, p, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j; try { j = await r.json(); } catch { j = null; }
  return { status: r.status, j };
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME
});
const comb = async where => { const [r] = await db.execute(`SELECT id,id_material_planta_entrada,id_agua,id_dueno_volqueta,valor,id_gasolinera FROM combustible WHERE ${where}`); return r; };

let idEntrada, idAgua, idA, idB;
try {
  // ---------- AUTH ----------
  log('\n===== AUTENTICACIÓN =====');
  let r = await req('POST', '/auth/login', { username: USER, password: PASS });
  TOKEN = r.j?.data?.token || '';
  check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
  if (!TOKEN) throw new Error('Sin token, no se puede continuar');

  // IDs base
  const [veh] = await db.execute('SELECT vv.id, vv.id_dueno_volqueta FROM volqueta_vehiculo vv WHERE vv.activo=1 ORDER BY vv.id LIMIT 1');
  const idVehiculo = veh[0].id, idDueno = veh[0].id_dueno_volqueta;

  // ---------- MATERIAL ----------
  log('\n===== MATERIAL (flete) =====');
  r = await req('POST', '/material/entrada', { numero_volqueta: 9999, id_mina: 1, id_vehiculo: idVehiculo, id_tipo_material: 1, fecha_llegada: '2026-09-02', peso_llegada_planta: 10, acpm: 200000 });
  idEntrada = r.j?.data?.id ?? r.j?.id;
  check('POST /material/entrada (con acpm, sin gasolinera)', r.status === 201 && !!idEntrada, `id=${idEntrada}`);
  let c = await comb(`id_material_planta_entrada=${idEntrada}`);
  check('crea 1 fila en Combustible (id_gasolinera NULL)', c.length === 1 && money(c[0].valor) === 200000 && c[0].id_gasolinera === null, `valor=${c[0]?.valor}`);

  r = await req('GET', `/material/entradas/${idEntrada}`);
  let d = r.j?.data?.detalle;
  check('GET detalle expone acpm_adelantado', money(d?.acpm_adelantado) === 200000);
  check('GET detalle expone flete_neto = max(0,flete-acpm)', money(d?.flete_neto) === Math.max(0, money(d?.flete) - 200000), `flete=${money(d?.flete)} neto=${money(d?.flete_neto)}`);

  await req('PUT', `/material/entradas/${idEntrada}`, { id_mina: 1, id_vehiculo: idVehiculo, peso_llegada_planta: 12, acpm: 150000 });
  r = await req('GET', `/material/entradas/${idEntrada}`); d = r.j?.data?.detalle;
  check('PUT sincroniza acpm a 150000 y recalcula flete_neto', money(d?.acpm_adelantado) === 150000 && money(d?.flete_neto) === Math.max(0, money(d?.flete) - 150000), `flete=${money(d?.flete)} neto=${money(d?.flete_neto)}`);

  r = await req('GET', '/material/entradas?desde=2026-09-01&hasta=2026-09-30');
  let row = (r.j?.data || []).find(x => x.id === idEntrada);
  check('GET listado expone acpm_adelantado y flete_neto', row && money(row.acpm_adelantado) === 150000 && money(row.flete_neto) === Math.max(0, money(row.flete) - 150000));

  await req('PATCH', `/material/entradas/${idEntrada}/gastos-operativos`, { costo_cargue: 5000 });
  c = await comb(`id_material_planta_entrada=${idEntrada}`);
  check('PATCH gastos-operativos NO altera el ACPM', c.length === 1 && money(c[0].valor) === 150000);

  await req('PUT', `/material/entradas/${idEntrada}`, { id_mina: 1, id_vehiculo: idVehiculo, peso_llegada_planta: 12, acpm: 0 });
  c = await comb(`id_material_planta_entrada=${idEntrada}`);
  check('PUT acpm:0 borra la fila de Combustible', c.length === 0);

  r = await req('DELETE', `/material/entradas/${idEntrada}`);
  c = await comb(`id_material_planta_entrada=${idEntrada}`);
  check('DELETE entrada (200) borra su Combustible', r.status === 200 && c.length === 0);
  idEntrada = null;

  // ---------- ARRASTRE POR DUEÑO ----------
  log('\n===== ARRASTRE ACPM POR DUEÑO =====');
  // A: flete pequeño con ACPM grande -> neto 0 y sobrante al siguiente. B: siguiente viaje del dueño.
  r = await req('POST', '/material/entrada', { numero_volqueta: 9001, id_mina: 1, id_vehiculo: idVehiculo, id_tipo_material: 1, fecha_llegada: '2026-12-30', peso_llegada_planta: 1, acpm: 0 });
  idA = r.j?.data?.id ?? r.j?.id;
  await req('PUT', `/material/entradas/${idA}`, { id_mina: 1, id_vehiculo: idVehiculo, peso_llegada_planta: 1, acpm: 200000 }); // flete=110000, acpm 200000
  r = await req('POST', '/material/entrada', { numero_volqueta: 9002, id_mina: 1, id_vehiculo: idVehiculo, id_tipo_material: 1, fecha_llegada: '2026-12-31', peso_llegada_planta: 1, acpm: 0 });
  idB = r.j?.data?.id ?? r.j?.id;
  await req('PUT', `/material/entradas/${idB}`, { id_mina: 1, id_vehiculo: idVehiculo, peso_llegada_planta: 1, acpm: 0 }); // flete=110000, acpm 0
  r = await req('GET', `/pagos/combustible/dueno/${idDueno}/neto-flete`);
  const fa = (r.j?.data?.fletes || []).find(f => f.id_entrada === idA);
  const fb = (r.j?.data?.fletes || []).find(f => f.id_entrada === idB);
  check('viaje A: ACPM(200k) > flete(110k) → flete_neto 0', fa && money(fa.flete_neto) === 0, `neto=${money(fa?.flete_neto)}`);
  check('viaje B: recibe arrastre (90k) → flete_neto 20000', fb && money(fb.flete_neto) === 20000, `neto=${money(fb?.flete_neto)}`);

  await req('DELETE', `/material/entradas/${idA}`); idA = null;
  await req('DELETE', `/material/entradas/${idB}`); idB = null;

  // ---------- AGUA ----------
  log('\n===== AGUA =====');
  r = await req('POST', '/material/agua', { id_vehiculo: idVehiculo, fecha: '2026-09-02', valor_viaje: 50000, cantidad_viajes: 2, acpm: 30000 });
  idAgua = r.j?.data?.id ?? r.j?.id;
  check('POST /material/agua espeja ACPM a Combustible', !!idAgua && (await comb(`id_agua=${idAgua}`)).length === 1, `id=${idAgua}`);

  r = await req('GET', `/material/agua/${idAgua}`); let a = r.j?.data;
  check('GET agua: valor_total BRUTO(100000), acpm(30000), valor_neto(70000)', money(a?.valor_total) === 100000 && money(a?.acpm) === 30000 && money(a?.valor_neto) === 70000, `vt=${money(a?.valor_total)} neto=${money(a?.valor_neto)}`);

  r = await req('GET', '/material/agua/reporte-mensual?mes=9&anio=2026');
  const du = (r.j?.data?.duenos || []).find(x => x.id_dueno === idDueno);
  check('reporte-mensual: neto_mes = bruto - acpm', du && money(du.resumen.neto_mes) === money(du.resumen.bruto) - money(du.resumen.acpm));

  await req('PUT', `/material/agua/${idAgua}`, { acpm: 10000 });
  r = await req('GET', `/material/agua/${idAgua}`); a = r.j?.data;
  check('PUT agua re-sincroniza (acpm 10000 → neto 90000)', money(a?.acpm) === 10000 && money(a?.valor_neto) === 90000);

  r = await req('DELETE', `/material/agua/${idAgua}`);
  check('DELETE agua (200) borra su Combustible', r.status === 200 && (await comb(`id_agua=${idAgua}`)).length === 0);
  idAgua = null;

  // ---------- COMBUSTIBLE ----------
  log('\n===== COMBUSTIBLE =====');
  r = await req('GET', '/pagos/combustible?desde=2026-01-01&hasta=2026-12-31');
  check('GET /pagos/combustible (lista)', r.status === 200 && Array.isArray(r.j?.data));
  r = await req('GET', `/pagos/combustible/dueno/${idDueno}/neto-flete`);
  check('GET /pagos/combustible/dueno/:id/neto-flete (totales)', r.status === 200 && r.j?.data && 'total_flete_neto' in r.j.data);

} catch (e) {
  check('ejecución sin excepciones', false, e.message);
} finally {
  // Limpieza defensiva
  for (const [p, id] of [['/material/entradas/', idEntrada], ['/material/entradas/', idA], ['/material/entradas/', idB], ['/material/agua/', idAgua]]) {
    if (id) { try { await req('DELETE', p + id); } catch {} }
  }
  // Reporte .md
  const okN = results.filter(r => r.ok).length, failN = results.length - okN;
  const fecha = new Date().toISOString().slice(0, 10);
  let md = `# Reporte de pruebas — ACPM / Combustible (Fase A)\n\n`;
  md += `> Generado por \`tests/acpm.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
  md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
  md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
  results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${r.detail || ''} |\n`; });
  md += `\n## Endpoints cubiertos\n`;
  md += `- Material: POST /material/entrada · GET /material/entradas/:id · GET /material/entradas · PUT /material/entradas/:id · PATCH /material/entradas/:id/gastos-operativos · DELETE /material/entradas/:id\n`;
  md += `- Agua: POST /material/agua · GET /material/agua/:id · GET /material/agua/reporte-mensual · PUT /material/agua/:id · DELETE /material/agua/:id\n`;
  md += `- Combustible: GET /pagos/combustible · GET /pagos/combustible/dueno/:id/neto-flete\n`;
  fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
  const out = path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_ACPM_${fecha}.md`);
  fs.writeFileSync(out, md);
  log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
  log('Reporte escrito en', out);
  await db.end();
  process.exit(failN > 0 ? 1 : 0);
}
