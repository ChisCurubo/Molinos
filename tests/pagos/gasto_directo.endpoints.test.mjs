/**
 * Test de endpoints de GASTO DIRECTO (reemplaza Caja Menor, decisión 2026-10-22):
 * todo gasto pagado de inmediato (parqueadero, peajes, etc.) es su propia Cuenta_Por_Pagar
 * ya pagada (CxP + Abonos_CxP en el mismo paso), con comprobante obligatorio.
 *
 *  - POST/GET /pagos/gastos-directos
 *  - GET      /pagos/gastos-directos/:id
 *  - DELETE   /pagos/gastos-directos/:id   (anula, borrado lógico)
 *
 * Requisitos: server en :3005, migracion_gasto_directo_2026-10-22.sql ya aplicada
 * (categoría 'Gasto Directo' en Categorias_CxP).
 * Uso:  node tests/pagos/gasto_directo.endpoints.test.mjs
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

const RUN = String(Date.now()).slice(-6);   // sufijo único por corrida
let idGasto1, idGasto2;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        const ids = [idGasto1, idGasto2].filter(Boolean);
        if (ids.length) {
            const inIds = ids.map(() => '?').join(',');
            await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inIds})`, ids);
            await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inIds})`, ids);
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

    // ---------- Setup: verifica la migración ----------
    log('\n===== SETUP (verifica migración aplicada) =====');
    const [catRows] = await db.query("SELECT id FROM Categorias_CxP WHERE nombre = 'Gasto Directo'");
    check("categoría 'Gasto Directo' existe en Categorias_CxP (migración aplicada)", catRows.length === 1, `n=${catRows.length}`);

    // ---------- Validaciones ----------
    log('\n===== VALIDACIONES =====');
    r = await req('POST', '/pagos/gastos-directos', { monto: 15000, comprobante_url: 'https://x/a.png' });
    check('sin concepto → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/gastos-directos', { concepto: `ZZ_TEST_${RUN}`, monto: 0, comprobante_url: 'https://x/a.png' });
    check('monto=0 → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/gastos-directos', { concepto: `ZZ_TEST_${RUN}`, monto: 15000 });
    check('sin comprobante_url → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Crear: queda como CxP ya pagada, con su abono ----------
    log('\n===== CREAR GASTO DIRECTO =====');
    r = await req('POST', '/pagos/gastos-directos', {
        concepto: `ZZ_TEST_PARQUEADERO_${RUN}`, monto: 15000, fecha: '2026-10-22',
        metodo_pago: 'efectivo', comprobante_url: 'https://x/parqueadero.png'
    });
    idGasto1 = r.j?.data?.id;
    check('POST crea la CxP ya pagada con su abono',
        r.status === 201 && !!idGasto1 && r.j?.data?.estado === 'pagado' && near(r.j?.data?.monto, 15000) && !!r.j?.data?.id_abono && r.j?.data?.comprobante_url === 'https://x/parqueadero.png',
        `data=${JSON.stringify(r.j?.data)}`);

    const [cxpRow] = await db.query('SELECT estado, valor_total, valor_pagado, id_categoria FROM Cuentas_Por_Pagar WHERE id = ?', [idGasto1]);
    check("la CxP en BD queda 'pagado' por el total, categoría Gasto Directo",
        cxpRow[0]?.estado === 'pagado' && near(cxpRow[0]?.valor_total, 15000) && near(cxpRow[0]?.valor_pagado, 15000) && cxpRow[0]?.id_categoria === catRows[0]?.id,
        `row=${JSON.stringify(cxpRow[0])}`);

    const [relRows] = await db.query('SELECT COUNT(*) AS n FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar = ?', [idGasto1]);
    check('no crea fila en Cuentas_Por_Pagar_Relacion (no hay entidad de dominio que enlazar)', relRows[0].n === 0, `n=${relRows[0].n}`);

    // ---------- Detalle y listado ----------
    log('\n===== DETALLE Y LISTADO =====');
    r = await req('GET', `/pagos/gastos-directos/${idGasto1}`);
    check('GET /:id devuelve el gasto', r.status === 200 && r.j?.data?.concepto === `ZZ_TEST_PARQUEADERO_${RUN}`, `data=${JSON.stringify(r.j?.data)}`);

    r = await req('GET', '/pagos/gastos-directos?desde=2026-10-22&hasta=2026-10-22');
    check('GET lista filtrada por fecha incluye el creado', r.status === 200 && (r.j?.data || []).some(g => g.id === idGasto1), `n=${r.j?.data?.length}`);

    r = await req('GET', '/pagos/gastos-directos/999999999');
    check('GET /:id inexistente → 404', r.status === 404, `status=${r.status}`);

    // ---------- Editar (corregir un dato mal digitado) ----------
    log('\n===== EDITAR =====');
    r = await req('PATCH', `/pagos/gastos-directos/${idGasto1}`, { monto: 18000, comprobante_url: 'https://x/parqueadero-correcto.png' });
    check('PATCH actualiza monto y comprobante_url',
        r.status === 200 && near(r.j?.data?.monto, 18000) && r.j?.data?.comprobante_url === 'https://x/parqueadero-correcto.png',
        `data=${JSON.stringify(r.j?.data)}`);

    const [cxpEditado] = await db.query('SELECT valor_total, valor_pagado FROM Cuentas_Por_Pagar WHERE id = ?', [idGasto1]);
    check('BD: valor_total y valor_pagado quedan iguales al nuevo monto (sigue 1:1 pagada)',
        near(cxpEditado[0]?.valor_total, 18000) && near(cxpEditado[0]?.valor_pagado, 18000), `row=${JSON.stringify(cxpEditado[0])}`);

    r = await req('PATCH', `/pagos/gastos-directos/${idGasto1}`, { monto: 0 });
    check('PATCH monto=0 → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('PATCH', `/pagos/gastos-directos/${idGasto1}`, { comprobante_url: '' });
    check('PATCH comprobante_url vacío → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('PATCH', `/pagos/gastos-directos/999999999`, { monto: 1000 });
    check('PATCH a gasto inexistente → 404', r.status === 404, `status=${r.status}`);

    // ---------- Segundo gasto, para anular ----------
    log('\n===== ANULAR (BORRADO LÓGICO) =====');
    r = await req('POST', '/pagos/gastos-directos', { concepto: `ZZ_TEST_PEAJE_${RUN}`, monto: 8000, comprobante_url: 'https://x/peaje.png' });
    idGasto2 = r.j?.data?.id;
    check('crea 2do gasto directo para probar anulación', r.status === 201 && !!idGasto2, `id=${idGasto2}`);

    r = await req('DELETE', `/pagos/gastos-directos/${idGasto2}`);
    check('DELETE /:id anula (200)', r.status === 200, `status=${r.status}`);

    const [row2] = await db.query('SELECT estado, deleted_at FROM Cuentas_Por_Pagar WHERE id = ?', [idGasto2]);
    check("queda estado='anulado' con deleted_at, el Abono NO se borra (auditoría)",
        row2[0]?.estado === 'anulado' && !!row2[0]?.deleted_at,
        `row=${JSON.stringify(row2[0])}`);
    const [abonoRows] = await db.query('SELECT COUNT(*) AS n FROM Abonos_CxP WHERE id_cuenta_pagar = ?', [idGasto2]);
    check('el abono sigue existiendo tras anular', abonoRows[0].n === 1, `n=${abonoRows[0].n}`);

    r = await req('GET', '/pagos/gastos-directos');
    check('el gasto anulado ya no aparece en el listado', !(r.j?.data || []).some(g => g.id === idGasto2));

    r = await req('DELETE', `/pagos/gastos-directos/${idGasto2}`);
    check('anular dos veces el mismo gasto → 404', r.status === 404, `status=${r.status}`);

    r = await req('PATCH', `/pagos/gastos-directos/${idGasto2}`, { monto: 1000 });
    check('PATCH a un gasto ya anulado → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Gasto Directo (CxP ya pagada en un solo paso)\n\n`;
    md += `> Generado por \`tests/pagos/gasto_directo.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- POST/GET /pagos/gastos-directos\n`;
    md += `- GET/DELETE /pagos/gastos-directos/:id\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_GASTO_DIRECTO_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
