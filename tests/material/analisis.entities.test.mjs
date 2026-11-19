/**
 * Test PROFUNDO de endpoints de ANÁLISIS (lógica migrada de triggers de BD).
 *  - Tipo 1 (Cabeza): tenor < 4 → excedente_calculado = 0 ; tenor >= 4 → excedente = ton_seco × tarifa
 *  - Edición recalcula (PUT), agregarValor (PATCH /valor), marcarPago (PATCH /pago)
 *  - Listados: por minero / por mina / por fecha / por entrada / por id
 *  - Tipo 2 (Concentrado): análisis del lote, sin id_entrada
 *  - Regla de borrado: 409 si la entrada está en_proceso/incluida_viaje/pagada
 *
 * Requisitos: server en :3005, id_mina=1 / id_tipo_material=1 seedeados (como el resto de tests/).
 * Uso:  node tests/material/analisis.entities.test.mjs
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3005/api/v1';
const USER = process.env.LOGIN_USER || 'david@molinosdecolombia.com';
const PASS = process.env.LOGIN_PASS || 'molinos2026';

const money = n => (n === null || n === undefined) ? n : Number(n);
const near = (a, b, eps = 1) => Math.abs(Number(a) - Number(b)) <= eps;
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

const RUN = String(Date.now()).slice(-6);
let entradaBajo, entradaAlto, idAnalisisBajo, idAnalisisAlto, idLoteConcentrado, idAnalisisConcentrado;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (idAnalisisConcentrado) await db.query('DELETE FROM analisis WHERE id = ?', [idAnalisisConcentrado]);
        if (idLoteConcentrado) await db.query('DELETE FROM material_concentrado WHERE id = ?', [idLoteConcentrado]);
        for (const id of [entradaBajo, entradaAlto]) {
            if (id) {
                await db.query('UPDATE material_planta_entrada SET estado = "pendiente" WHERE id = ?', [id]); // desbloquea si quedó en pagada/incluida_viaje
                await db.query('DELETE FROM analisis WHERE id_entrada = ?', [id]);
                await db.query('DELETE FROM material_planta_entrada WHERE id = ?', [id]);
            }
        }
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== SETUP: 2 entradas de material =====');
    const mkEntrada = async (num) => {
        const rr = await req('POST', '/material/entrada', { numero_volqueta: num, id_mina: 1, id_vehiculo: 1, id_tipo_material: 1, fecha_llegada: '2026-08-15', peso_llegada_planta: 20 });
        return rr.j?.data?.id ?? rr.j?.id;
    };
    entradaBajo = await mkEntrada(70001 + Number(RUN.slice(-2)));
    entradaAlto = await mkEntrada(70101 + Number(RUN.slice(-2)));
    check('crea entrada (tenor bajo)', !!entradaBajo, `id=${entradaBajo}`);
    check('crea entrada (tenor alto)', !!entradaAlto, `id=${entradaAlto}`);

    log('\n===== TIPO 1 (Cabeza): EXCEDENTE SOLO SI TENOR >= 4 =====');
    // peso 20t, humedad 10% -> ton_seco = 18. au=50 -> tenor=50/18=2.78 (<4, sin excedente)
    r = await req('POST', '/material/analisis/cabeza', { id_entrada: entradaBajo, porcentaje_humedad: 0.10, au_concentrado: 50, au_falso: 3, ag_concentrado: 0 });
    check('POST /analisis/cabeza (tenor bajo) → 201', r.status === 201, `status=${r.status}`);
    let d = await req('GET', `/material/entradas/${entradaBajo}`);
    let det = d.j?.data;
    check('tenor < 4 → excedente_calculado = 0', near(money(det?.excedente_calculado), 0), `excedente=${det?.excedente_calculado}`);
    check('total_material_seco = 18 (20 × (1-0.10))', near(money(det?.total_material_seco), 18), `seco=${det?.total_material_seco}`);

    // peso 20t, humedad 10% -> ton_seco = 18. au=100 -> tenor=100/18=5.56 (>=4 → excedente = 18 × 100000 = 1.800.000)
    r = await req('POST', '/material/analisis/cabeza', { id_entrada: entradaAlto, porcentaje_humedad: 0.10, au_concentrado: 100, au_falso: 5, ag_concentrado: 0 });
    check('POST /analisis/cabeza (tenor alto) → 201', r.status === 201, `status=${r.status}`);
    d = await req('GET', `/material/entradas/${entradaAlto}`);
    det = d.j?.data;
    check('tenor >= 4 → excedente_calculado = ton_seco × 100000', near(money(det?.excedente_calculado), 1_800_000), `excedente=${det?.excedente_calculado}`);
    check('total_material incluye el excedente', money(det?.total_material) >= 1_800_000, `total=${det?.total_material}`);

    log('\n===== LECTURA por id / por entrada / por query =====');
    r = await req('GET', `/material/analisis/entrada/${entradaAlto}/cabeza`);
    idAnalisisAlto = r.j?.data?.id;
    check('GET /analisis/entrada/:id/cabeza (200, trae el análisis)', r.status === 200 && !!idAnalisisAlto, `id=${idAnalisisAlto}`);

    r = await req('GET', `/material/analisis/entrada/${entradaBajo}/cabeza`);
    idAnalisisBajo = r.j?.data?.id;
    check('GET /analisis/entrada/:id/cabeza (entrada tenor bajo)', r.status === 200 && !!idAnalisisBajo, `id=${idAnalisisBajo}`);

    r = await req('GET', `/material/analisis/${idAnalisisAlto}`);
    check('GET /analisis/:id detalle (200)', r.status === 200 && Number(r.j?.data?.id) === Number(idAnalisisAlto));

    r = await req('GET', `/material/analisis/entrada/${entradaAlto}`);
    check('GET /analisis/entrada/:id (todos) incluye 1 registro', Array.isArray(r.j?.data) && r.j.data.length === 1, `n=${r.j?.data?.length}`);

    r = await req('GET', `/material/analisis?id_entrada=${entradaAlto}`);
    check('GET /analisis?id_entrada= (query) equivalente', Array.isArray(r.j?.data) && r.j.data.length === 1, `n=${r.j?.data?.length}`);

    log('\n===== LISTADOS por minero / mina / fecha =====');
    const minaInfo = await req('GET', '/material/mina/1');
    const idMinero1 = minaInfo.j?.data?.minero_id;
    r = await req('GET', `/material/analisis/minero/${idMinero1}`);
    check('GET /analisis/minero/:id_minero (200, incluye ambos análisis)', r.status === 200 && (r.j?.data || []).filter(a => [entradaBajo, entradaAlto].includes(Number(a.id_entrada))).length === 2, `n=${r.j?.data?.length}`);

    r = await req('GET', '/material/analisis/mina/1');
    check('GET /analisis/mina/:id_mina (200)', r.status === 200 && Array.isArray(r.j?.data));

    r = await req('GET', '/material/analisis/fecha/2026-08-15');
    check('GET /analisis/fecha/:fecha (200, incluye ambos)', (r.j?.data || []).filter(a => [entradaBajo, entradaAlto].includes(Number(a.id_entrada))).length === 2, `n=${r.j?.data?.length}`);

    log('\n===== EDITAR (PUT) recalcula =====');
    r = await req('PUT', `/material/analisis/${idAnalisisBajo}`, { au_concentrado: 200 }); // sube el tenor: 200/18=11.1 (>=4)
    check('PUT /analisis/:id (200)', r.status === 200, `status=${r.status}`);
    d = await req('GET', `/material/entradas/${entradaBajo}`);
    det = d.j?.data;
    check('tras editar, tenor ahora >= 4 → excedente > 0', money(det?.excedente_calculado) > 0, `excedente=${det?.excedente_calculado}`);

    log('\n===== PATCH /valor y /pago =====');
    r = await req('PATCH', `/material/analisis/${idAnalisisAlto}/valor`, { valor_analisis: 150000 });
    check('PATCH /analisis/:id/valor (200)', r.status === 200, `status=${r.status}`);

    r = await req('PATCH', `/material/analisis/${idAnalisisAlto}/pago`, { estado: 'pagado' });
    check('PATCH /analisis/:id/pago (200)', r.status === 200, `status=${r.status}`);

    log('\n===== TIPO 2 (Concentrado) =====');
    r = await req('POST', '/material/concentrado', { codigo: `ZZ_LOTE_${RUN}`, fecha_inicio: '2026-08-15' });
    idLoteConcentrado = r.j?.data?.id ?? r.j?.id;
    check('POST /concentrado crea lote (201)', r.status === 201 && !!idLoteConcentrado, `id=${idLoteConcentrado}`);

    r = await req('POST', '/material/analisis', { id_material_concentrado: idLoteConcentrado, porcentaje_humedad: 0.13, au_concentrado: 120, ag_concentrado: 500 });
    check('POST /analisis (tipo 2, concentrado) → 201', r.status === 201, `status=${r.status} body=${JSON.stringify(r.j)}`);

    r = await req('GET', `/material/analisis/concentrado/${idLoteConcentrado}`);
    idAnalisisConcentrado = (r.j?.data || [])[0]?.id;
    check('GET /analisis/concentrado/:id_lote devuelve el análisis del lote', r.status === 200 && !!idAnalisisConcentrado, `n=${r.j?.data?.length}`);

    log('\n===== REGLA DE BORRADO: 409 si la entrada NO está en pendiente/en_proceso =====');
    await db.query('UPDATE material_planta_entrada SET estado = "pagada" WHERE id = ?', [entradaAlto]);
    r = await req('DELETE', `/material/analisis/${idAnalisisAlto}`);
    check('DELETE análisis de entrada pagada → 409', r.status === 409, `status=${r.status}`);
    await db.query('UPDATE material_planta_entrada SET estado = "en_proceso" WHERE id = ?', [entradaAlto]);

    r = await req('DELETE', `/material/analisis/${idAnalisisAlto}`);
    check('DELETE análisis de entrada en_proceso → 200 (revierte a pendiente)', r.status === 200, `status=${r.status}`);
    idAnalisisAlto = null;
    d = await req('GET', `/material/entradas/${entradaAlto}`);
    check('tras borrar, la entrada vuelve a pendiente', (d.j?.data?.estado ?? d.j?.data?.detalle?.estado) === 'pendiente', `estado=${d.j?.data?.estado}`);

    r = await req('DELETE', `/material/analisis/${idAnalisisBajo}`);
    check('DELETE análisis (entrada bajo, en_proceso) → 200', r.status === 200, `status=${r.status}`);
    idAnalisisBajo = null;

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — ANÁLISIS\n\n`;
    md += `> Generado por \`tests/material/analisis.entities.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- POST /analisis · POST /analisis/cabeza · GET /analisis/:id · GET /analisis?id_entrada= · GET /analisis/entrada/:id[/cabeza]\n`;
    md += `- GET /analisis/minero/:id · /mina/:id · /fecha/:fecha · /concentrado/:id_lote\n`;
    md += `- PUT /analisis/:id · PATCH /:id/valor · PATCH /:id/pago · DELETE /:id (con regla 409)\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_ANALISIS_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
