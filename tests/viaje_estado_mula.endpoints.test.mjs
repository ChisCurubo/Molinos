/**
 * Test del selector de viajes para Mulas + el cambio de estado del Viaje
 * (almacenado ↔ despachado) al crear/editar/eliminar una Mula.
 *
 *  - GET /material/viajes/disponibles-mula  (solo viajes 'almacenado' CON líneas)
 *  - POST /pagos/mulas con id_viaje         → viaje pasa a 'despachado', desaparece del selector
 *  - POST /pagos/mulas con id_viaje ya despachado → 409
 *  - PATCH /pagos/mulas/:id { id_viaje: null } → viaje vuelve a 'almacenado', reaparece
 *  - DELETE /pagos/mulas/:id (sin abonos)   → revierte el viaje a 'almacenado'
 *
 * Requisitos: server en :3005 + migracion_viaje_estado_2026-09-13.sql aplicada
 *             + migracion_mulas_2026-09-13.sql aplicada.
 * Uso:  node tests/viaje_estado_mula.endpoints.test.mjs
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
let idViaje, idProveedor, idMula, idLineaVm;
async function estadoViaje(id) {
    const [r] = await db.execute('SELECT estado FROM Viaje WHERE id=?', [id]);
    return r[0]?.estado;
}
async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (idMula) {
            const [rel] = await db.query('SELECT DISTINCT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_mula=?', [idMula]);
            const cuentas = rel.map(r => r.id_cuenta_pagar);
            if (cuentas.length) {
                const inCu = cuentas.map(() => '?').join(',');
                await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
            }
            await db.query('DELETE FROM Mulas WHERE id=?', [idMula]);
        }
        if (idLineaVm) await db.query('DELETE FROM viaje_material WHERE id=?', [idLineaVm]);
        if (idProveedor) await db.query('DELETE FROM Proveedores WHERE id=?', [idProveedor]);
        if (idViaje) await db.query('DELETE FROM Viaje WHERE id=?', [idViaje]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== SETUP (viaje sin líneas + proveedor) =====');
    r = await req('POST', '/material/viajes', { numero_viaje: `ZZT-${RUN}`, fecha: '2026-09-01' });
    idViaje = r.j?.data?.id ?? r.j?.id;
    check('crea viaje de prueba', !!idViaje, `id=${idViaje}`);
    check('viaje nace en estado almacenado', (await estadoViaje(idViaje)) === 'almacenado', `estado=${await estadoViaje(idViaje)}`);

    const [[cat]] = [(await db.query("SELECT id FROM Categorias_Proveedor WHERE nombre='Transporte_Mula'"))[0]];
    const [insP] = await db.query('INSERT INTO Proveedores (nombre, id_categoria, estado) VALUES (?, ?, ?)', [`ZZ_TEST_PROV_${RUN}`, cat.id, 'activo']);
    idProveedor = insP.insertId;

    log('\n===== GET /material/viajes/disponibles-mula (sin líneas → NO aparece) =====');
    r = await req('GET', '/material/viajes/disponibles-mula');
    check('viaje sin líneas NO aparece en el selector', r.status === 200 && !(r.j?.data || []).some(v => v.id === idViaje), `ids=${(r.j?.data || []).map(v => v.id)}`);

    log('\n===== Se le agrega una línea (carga) al viaje → SÍ debe aparecer =====');
    const [insVm] = await db.query('INSERT INTO viaje_material (id_viaje, es_remanente, concentrado_seco) VALUES (?, 0, 5)', [idViaje]);
    idLineaVm = insVm.insertId;
    r = await req('GET', '/material/viajes/disponibles-mula');
    const fila = (r.j?.data || []).find(v => v.id === idViaje);
    check('viaje CON línea aparece en el selector', r.status === 200 && !!fila, `ids=${(r.j?.data || []).map(v => v.id)}`);
    check('num_lineas=1 y toneladas_seco=5', fila && Number(fila.num_lineas) === 1 && Number(fila.toneladas_seco) === 5, `linea=${JSON.stringify(fila)}`);

    log('\n===== POST /pagos/mulas con id_viaje → despacha el viaje =====');
    r = await req('POST', '/pagos/mulas', { id_proveedor: idProveedor, valor: 500000, fecha: '2026-09-02', id_viaje: idViaje });
    idMula = r.j?.data?.id;
    check('crea la mula vinculada al viaje (201)', r.status === 201 && !!idMula, `status=${r.status} id=${idMula}`);
    check('el viaje pasó a despachado', (await estadoViaje(idViaje)) === 'despachado', `estado=${await estadoViaje(idViaje)}`);

    r = await req('GET', '/material/viajes/disponibles-mula');
    check('el viaje YA NO aparece en el selector (despachado)', !(r.j?.data || []).some(v => v.id === idViaje), `ids=${(r.j?.data || []).map(v => v.id)}`);

    log('\n===== Intentar despachar el MISMO viaje otra vez → 409 =====');
    r = await req('POST', '/pagos/mulas', { id_proveedor: idProveedor, valor: 300000, fecha: '2026-09-03', id_viaje: idViaje });
    check('segunda mula sobre el mismo viaje → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    log('\n===== PATCH desvincular (id_viaje:null) → viaje vuelve a almacenado =====');
    r = await req('PATCH', `/pagos/mulas/${idMula}`, { id_viaje: null });
    check('PATCH desvincula (200)', r.status === 200, `status=${r.status}`);
    check('el viaje vuelve a almacenado', (await estadoViaje(idViaje)) === 'almacenado', `estado=${await estadoViaje(idViaje)}`);
    r = await req('GET', '/material/viajes/disponibles-mula');
    check('el viaje reaparece en el selector', (r.j?.data || []).some(v => v.id === idViaje), `ids=${(r.j?.data || []).map(v => v.id)}`);

    log('\n===== Re-vincular por PATCH → despacha de nuevo =====');
    r = await req('PATCH', `/pagos/mulas/${idMula}`, { id_viaje: idViaje });
    check('PATCH re-vincula (200)', r.status === 200, `status=${r.status}`);
    check('el viaje vuelve a despachado', (await estadoViaje(idViaje)) === 'despachado', `estado=${await estadoViaje(idViaje)}`);

    log('\n===== DELETE la mula (sin abonos) → revierte el viaje =====');
    r = await req('DELETE', `/pagos/mulas/${idMula}`);
    check('DELETE mula (200)', r.status === 200, `status=${r.status}`);
    check('el viaje vuelve a almacenado tras eliminar la mula', (await estadoViaje(idViaje)) === 'almacenado', `estado=${await estadoViaje(idViaje)}`);
    idMula = null; // ya no existe

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Selector de viajes y estado (Viaje ↔ Mula)\n\n`;
    md += `> Generado por \`tests/viaje_estado_mula.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_VIAJE_ESTADO_MULA_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
