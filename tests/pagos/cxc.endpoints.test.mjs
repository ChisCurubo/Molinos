/**
 * Test de endpoints de CUENTAS POR COBRAR (CxC) — creación, que antes no existía.
 * Se puede crear sin abono (deuda pendiente de cobrar después) o con `abono` incluido
 * en el mismo paso (cobro inmediato, total o parcial) — decisión 2026-10-22.
 *
 *  - POST /pagos/cxc            (sin abono, o con abono inicial)
 *  - GET  /pagos/cxc/:id
 *  - POST /pagos/cxc/:id/abonos (cobro sobre una cuenta existente)
 *
 * Requisitos: server en :3005 (sin migración adicional — todo ya existía en la BD).
 * Uso:  node tests/pagos/cxc.endpoints.test.mjs
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
let idCategoria, idCxcSinAbono, idCxcConAbono;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        const ids = [idCxcSinAbono, idCxcConAbono].filter(Boolean);
        if (ids.length) {
            const inIds = ids.map(() => '?').join(',');
            await db.query(`DELETE FROM Abonos_CxC WHERE id_cxc IN (${inIds})`, ids);
            await db.query(`DELETE FROM Cuentas_Por_Cobrar WHERE id IN (${inIds})`, ids);
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

    log('\n===== SETUP =====');
    const [catRows] = await db.query("SELECT id FROM Categorias_CxC WHERE nombre = 'Otro cobro'");
    idCategoria = catRows[0]?.id;
    check("categoría 'Otro cobro' existe", !!idCategoria, `id=${idCategoria}`);

    // ---------- Validaciones ----------
    log('\n===== VALIDACIONES =====');
    r = await req('POST', '/pagos/cxc', { id_categoria: idCategoria, valor_total: 100000 });
    check('sin concepto → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/cxc', { concepto: `ZZ_TEST_${RUN}`, valor_total: 100000 });
    check('sin id_categoria → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/cxc', { id_categoria: idCategoria, concepto: `ZZ_TEST_${RUN}`, valor_total: 0 });
    check('valor_total=0 → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/cxc', { id_categoria: idCategoria, concepto: `ZZ_TEST_${RUN}`, valor_total: 100000, abono: { valor: 999999, comprobante_url: 'https://x/z.png' } });
    check('abono mayor al valor_total → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/cxc', { id_categoria: idCategoria, concepto: `ZZ_TEST_${RUN}`, valor_total: 100000, abono: { valor: 50000 } });
    check('abono sin comprobante_url → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Crear SIN abono (queda pendiente) ----------
    log('\n===== CREAR SIN ABONO =====');
    r = await req('POST', '/pagos/cxc', { id_categoria: idCategoria, concepto: `ZZ_TEST_SIN_ABONO_${RUN}`, valor_total: 300000, fecha_creacion: '2026-10-22' });
    idCxcSinAbono = r.j?.data?.id;
    check('POST sin abono crea la CxC pendiente, sin abonos',
        r.status === 201 && !!idCxcSinAbono && r.j?.data?.estado === 'pendiente' && near(r.j?.data?.valor_cobrado, 0) && (r.j?.data?.abonos || []).length === 0,
        `data=${JSON.stringify(r.j?.data)}`);

    // ---------- Validaciones del abono posterior ----------
    log('\n===== ABONAR DESPUÉS =====');
    r = await req('POST', `/pagos/cxc/${idCxcSinAbono}/abonos`, { valor: 100000 });
    check('abonar sin comprobante_url → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', `/pagos/cxc/${idCxcSinAbono}/abonos`, { valor: 999999, comprobante_url: 'https://x/a.png' });
    check('abonar más del saldo pendiente → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', `/pagos/cxc/${idCxcSinAbono}/abonos`, { valor: 120000, metodo: 'transferencia', comprobante_url: 'https://x/b.png', fecha_cobro: '2026-10-22' });
    check('cobro parcial → la cuenta queda parcial con 1 abono',
        r.status === 201 && r.j?.data?.estado === 'parcial' && near(r.j?.data?.valor_cobrado, 120000) && (r.j?.data?.abonos || []).length === 1,
        `data=${JSON.stringify(r.j?.data)}`);

    r = await req('POST', `/pagos/cxc/${idCxcSinAbono}/abonos`, { valor: 180000, comprobante_url: 'https://x/c.png' });
    check('cobro que completa el saldo → la cuenta queda cobrada',
        r.status === 201 && r.j?.data?.estado === 'cobrado' && near(r.j?.data?.valor_cobrado, 300000),
        `data=${JSON.stringify(r.j?.data)}`);

    r = await req('GET', `/pagos/cxc/${idCxcSinAbono}`);
    check('GET /:id refleja los 2 abonos', r.status === 200 && (r.j?.data?.abonos || []).length === 2, `n=${r.j?.data?.abonos?.length}`);

    // ---------- Crear CON abono inicial (cobro inmediato) ----------
    log('\n===== CREAR CON ABONO INICIAL =====');
    r = await req('POST', '/pagos/cxc', {
        id_categoria: idCategoria, concepto: `ZZ_TEST_CON_ABONO_${RUN}`, valor_total: 200000,
        abono: { valor: 200000, metodo: 'efectivo', comprobante_url: 'https://x/d.png' }
    });
    idCxcConAbono = r.j?.data?.id;
    check('POST con abono inicial que cubre el total → queda cobrada desde ya',
        r.status === 201 && !!idCxcConAbono && r.j?.data?.estado === 'cobrado' && near(r.j?.data?.valor_cobrado, 200000) && (r.j?.data?.abonos || []).length === 1,
        `data=${JSON.stringify(r.j?.data)}`);

    const [cxcRow] = await db.query('SELECT valor_total, valor_cobrado, estado FROM Cuentas_Por_Cobrar WHERE id = ?', [idCxcConAbono]);
    check('BD refleja valor_cobrado=valor_total y estado cobrado', near(cxcRow[0]?.valor_total, 200000) && near(cxcRow[0]?.valor_cobrado, 200000) && cxcRow[0]?.estado === 'cobrado', `row=${JSON.stringify(cxcRow[0])}`);

    r = await req('GET', '/pagos/cxc/999999999');
    check('GET /:id inexistente → 404', r.status === 404, `status=${r.status}`);

    // ---------- Editar ----------
    log('\n===== EDITAR =====');
    r = await req('PATCH', `/pagos/cxc/${idCxcSinAbono}`, { concepto: `ZZ_TEST_EDITADO_${RUN}`, valor_total: 350000 });
    check('PATCH actualiza concepto y valor_total, recalcula estado (ya no está cobrada del todo)',
        r.status === 200 && r.j?.data?.concepto === `ZZ_TEST_EDITADO_${RUN}` && near(r.j?.data?.valor_total, 350000) && r.j?.data?.estado === 'parcial',
        `data=${JSON.stringify(r.j?.data)}`);

    r = await req('PATCH', `/pagos/cxc/${idCxcSinAbono}`, { valor_total: 100000 });
    check('PATCH valor_total menor a lo ya cobrado (300000) → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('PATCH', `/pagos/cxc/${idCxcSinAbono}`, { id_minero: 1, id_proveedor: 2 });
    check('PATCH con dos deudores a la vez → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('PATCH', `/pagos/cxc/999999999`, { concepto: 'x' });
    check('PATCH a cuenta inexistente → 404', r.status === 404, `status=${r.status}`);

    // ---------- Anular (borrado lógico) ----------
    log('\n===== ANULAR =====');
    r = await req('DELETE', `/pagos/cxc/${idCxcConAbono}`);
    check('DELETE /:id anula (200)', r.status === 200, `status=${r.status}`);

    const [cxcAnulada] = await db.query('SELECT estado FROM Cuentas_Por_Cobrar WHERE id = ?', [idCxcConAbono]);
    check("queda estado='anulado'", cxcAnulada[0]?.estado === 'anulado', `row=${JSON.stringify(cxcAnulada[0])}`);
    const [abonosTrasAnular] = await db.query('SELECT COUNT(*) AS n FROM Abonos_CxC WHERE id_cxc = ?', [idCxcConAbono]);
    check('el cobro ya registrado se conserva (auditoría)', abonosTrasAnular[0].n === 1, `n=${abonosTrasAnular[0].n}`);

    r = await req('DELETE', `/pagos/cxc/${idCxcConAbono}`);
    check('anular dos veces la misma cuenta → 404', r.status === 404, `status=${r.status}`);

    r = await req('DELETE', '/pagos/cxc/999999999');
    check('DELETE /:id inexistente → 404', r.status === 404, `status=${r.status}`);

    r = await req('PATCH', `/pagos/cxc/${idCxcConAbono}`, { concepto: 'x' });
    check('PATCH a una cuenta ya anulada → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — CxC (creación sin/con abono inicial)\n\n`;
    md += `> Generado por \`tests/pagos/cxc.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- POST /pagos/cxc\n- GET /pagos/cxc/:id\n- POST /pagos/cxc/:id/abonos\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_CXC_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
