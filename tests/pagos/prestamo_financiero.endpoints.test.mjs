/**
 * Test de endpoints de PRESTAMOS FINANCIEROS (préstamo bancario/fondo de la empresa,
 * distinto de Prestamos_Empleados). CRUD completo (DELETE/PATCH nuevos 2026-09-19) con
 * el guard de borrado: solo se elimina si nunca tuvo actividad (saldo_pendiente == monto_principal).
 *
 *  - POST/GET/PUT/PATCH/DELETE /pagos/prestamos-financieros
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/pagos/prestamo_financiero.endpoints.test.mjs
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3005/api/v1';
const USER = process.env.LOGIN_USER || 'david@molinosdecolombia.com';
const PASS = process.env.LOGIN_PASS || 'molinos2026';

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
let idIntacto, idConActividad;
async function cleanup() {
    try {
        // Fase 2 (Tesorería): todo préstamo creado por API genera un Ingresos_Tesoreria
        // espejo (id_prestamo_fin) — hay que borrarlo antes que al préstamo por la FK.
        for (const id of [idIntacto, idConActividad]) {
            if (id) await db.query('DELETE FROM Ingresos_Tesoreria WHERE id_prestamo_fin = ?', [id]);
        }
        if (idIntacto) await db.query('DELETE FROM prestamos_financieros WHERE id = ?', [idIntacto]);
        if (idConActividad) await db.query('DELETE FROM prestamos_financieros WHERE id = ?', [idConActividad]);
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== CRUD Prestamo Financiero =====');
    r = await req('POST', '/pagos/prestamos-financieros', {
        nombre_prestamo: `ZZ_TEST_PRESTAMO_${RUN}`, fecha_adquisicion: '2026-09-19',
        monto_principal: 10000000, tasa_interes: 2, saldo_pendiente: 10000000
    });
    idIntacto = r.j?.data?.id;
    check('crea préstamo (201)', r.status === 201 && !!idIntacto, `status=${r.status} id=${idIntacto}`);

    r = await req('GET', `/pagos/prestamos-financieros/${idIntacto}`);
    check('detalle (200)', r.status === 200 && r.j?.data?.id === idIntacto, `data=${JSON.stringify(r.j?.data || {})}`);

    r = await req('PATCH', `/pagos/prestamos-financieros/${idIntacto}`, { tasa_interes: 2.5 });
    check('PATCH actualiza parcial (nuevo)', r.status === 200 && Number(r.j?.data?.tasa_interes) === 2.5, `tasa=${r.j?.data?.tasa_interes}`);

    r = await req('GET', '/pagos/prestamos-financieros');
    check('listado incluye el creado', r.status === 200 && (r.j?.data || []).some(p => p.id === idIntacto), `n=${r.j?.data?.length}`);

    log('\n===== DELETE con guard (nuevo) =====');
    r = await req('DELETE', `/pagos/prestamos-financieros/${idIntacto}`);
    check('eliminar préstamo intacto (saldo==principal) → 200', r.status === 200, `status=${r.status}`);
    idIntacto = null;

    r = await req('POST', '/pagos/prestamos-financieros', {
        nombre_prestamo: `ZZ_TEST_PRESTAMO2_${RUN}`, fecha_adquisicion: '2026-09-19',
        monto_principal: 5000000, tasa_interes: 1.5, saldo_pendiente: 5000000
    });
    idConActividad = r.j?.data?.id;
    check('setup: 2do préstamo creado', r.status === 201 && !!idConActividad, `id=${idConActividad}`);

    await req('PATCH', `/pagos/prestamos-financieros/${idConActividad}`, { saldo_pendiente: 3000000 });

    r = await req('DELETE', `/pagos/prestamos-financieros/${idConActividad}`);
    check('eliminar préstamo con actividad (saldo!=principal) → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('DELETE', '/pagos/prestamos-financieros/9999999');
    check('eliminar préstamo inexistente → 404', r.status === 404, `status=${r.status}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Préstamos Financieros\n\n`;
    md += `> Generado por \`tests/pagos/prestamo_financiero.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_PRESTAMO_FINANCIERO_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
