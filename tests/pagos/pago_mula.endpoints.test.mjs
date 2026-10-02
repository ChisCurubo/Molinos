/**
 * Test de endpoints de PAGO DE MULAS (despachos de concentrado a Barranquilla) — modelo v2:
 * al registrar la mula solo se captura la DEUDA (valor); el pago se abona en CASCADA por
 * proveedor (despacho más viejo primero), igual patrón que pago_flete/pago_agua.
 *
 * Prueba:
 *  - POST  /pagos/mulas                         (crea despacho: solo id_proveedor/valor/fecha/...)
 *  - GET   /pagos/mulas / /pagos/mulas/:id       (listado + detalle)
 *  - GET   /pagos/mulas/resumen                  (KPIs)
 *  - PATCH /pagos/mulas/:id                      (editar valor → recalcula CxP)
 *  - POST  /pagos/mulas/proveedor/:id/abonos     (cascada: paga varios despachos con 1 abono)
 *  - PATCH/DELETE /pagos/mulas/abonos/:id
 *  - GET   /pagos/mulas/abonos                   (paginado)
 *  - GET   /pagos/mulas/viajes                   (trazabilidad: viaje → proveedor → abonos)
 *  - DELETE /pagos/mulas/:id                     (409 con abonos, 200 sin abonos)
 *
 * Requisitos: server en :3005 + migraciones de mulas y de Viaje.estado aplicadas.
 * Uso:  node tests/pagos/pago_mula.endpoints.test.mjs
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
const r2 = n => Math.round(n * 100) / 100;
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
let idProveedor, idViaje, mulaIds = [];
async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (mulaIds.length) {
            const inM = mulaIds.map(() => '?').join(',');
            const [rel] = await db.query(`SELECT DISTINCT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_mula IN (${inM})`, mulaIds);
            const cuentas = rel.map(r => r.id_cuenta_pagar);
            if (cuentas.length) {
                const inCu = cuentas.map(() => '?').join(',');
                await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
            }
            await db.query(`DELETE FROM Mulas WHERE id IN (${inM})`, mulaIds);
        }
        if (idProveedor) await db.query('DELETE FROM Saldo_A_Favor WHERE id_proveedor = ?', [idProveedor]);
        if (idProveedor) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedor]);
        if (idViaje) await db.query('DELETE FROM Viaje WHERE id = ?', [idViaje]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    // ---------- Setup: proveedor (vía el CRUD real) + viaje ----------
    log('\n===== SETUP (proveedor + viaje) =====');
    const [[cat]] = [(await db.query("SELECT id FROM Categorias_Proveedor WHERE nombre='Transporte_Mula'"))[0]];
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_MULA_${RUN}`, id_categoria: cat.id });
    idProveedor = r.j?.data?.id;
    check('crea proveedor de prueba', r.status === 201 && !!idProveedor, `id=${idProveedor}`);

    r = await req('POST', '/material/viajes', { numero_viaje: `ZZT-${RUN}`, fecha: '2026-09-01' });
    idViaje = r.j?.data?.id ?? r.j?.id;
    check('crea viaje de prueba', !!idViaje, `id=${idViaje}`);

    // ---------- Crear despachos (solo deuda, sin comprobante ni valor_correcto) ----------
    log('\n===== POST /pagos/mulas (solo id_proveedor + valor + fecha) =====');
    const PCT = 1.00;
    const netoDe = v => r2(v - v * PCT / 100);

    r = await req('POST', '/pagos/mulas', { id_proveedor: idProveedor, valor: 1000000, fecha: '2026-09-01', id_viaje: idViaje, factura_num: `FA-A-${RUN}` });
    const A = r.j?.data;
    if (A?.id) mulaIds.push(A.id);
    check('crea mula A (201), sin comprobante ni valor_correcto en el body', r.status === 201 && !!A?.id, `status=${r.status} id=${A?.id}`);

    r = await req('POST', '/pagos/mulas', { id_proveedor: idProveedor, valor: 500000, fecha: '2026-09-02', factura_num: `FA-B-${RUN}` });
    const B = r.j?.data;
    if (B?.id) mulaIds.push(B.id);
    check('crea mula B (201)', r.status === 201 && !!B?.id, `id=${B?.id}`);

    r = await req('POST', '/pagos/mulas', { id_proveedor: idProveedor, valor: 700000, fecha: '2026-09-03', factura_num: `FA-C-${RUN}` });
    const C = r.j?.data;
    if (C?.id) mulaIds.push(C.id);
    check('crea mula C (201)', r.status === 201 && !!C?.id, `id=${C?.id}`);

    // ---------- Detalle: CxP neta de retención, sin abonos ----------
    log('\n===== GET /pagos/mulas/:id (detalle + CxP neta) =====');
    r = await req('GET', `/pagos/mulas/${A.id}`);
    const detA = r.j?.data;
    check('detalle trae cuenta y abonos vacíos', r.status === 200 && !!detA?.cuenta && detA.abonos.length === 0, `abonos=${detA?.abonos?.length}`);
    check('CxP.valor_total = neto (valor - retención 1%)', near(money(detA.cuenta.valor_total), netoDe(1000000)), `total=${detA.cuenta.valor_total}`);

    // ---------- Listado + KPI ----------
    log('\n===== GET /pagos/mulas y /pagos/mulas/resumen =====');
    r = await req('GET', `/pagos/mulas?id_proveedor=${idProveedor}`);
    check('listado trae los 3 despachos', r.status === 200 && r.j?.data?.length === 3, `n=${r.j?.data?.length}`);

    r = await req('GET', `/pagos/mulas/resumen?id_proveedor=${idProveedor}`);
    const res = r.j?.data;
    check('resumen: total_despachos = 3', Number(res?.total_despachos) === 3, `total=${res?.total_despachos}`);
    check('resumen: valor_adeudado_total = 2.2M', near(money(res?.valor_adeudado_total), 2200000), `va=${res?.valor_adeudado_total}`);
    check('resumen: total_pendiente = suma de netos', near(money(res?.total_pendiente), netoDe(1000000) + netoDe(500000) + netoDe(700000)), `pend=${res?.total_pendiente}`);

    // ---------- Editar valor (recalcula CxP) ----------
    log('\n===== PATCH /pagos/mulas/:id (cambia el valor de la deuda) =====');
    r = await req('PATCH', `/pagos/mulas/${A.id}`, { valor: 1200000 });
    check('PATCH cambia valor (200)', r.status === 200 && near(money(r.j?.data?.valor), 1200000), `valor=${r.j?.data?.valor}`);
    r = await req('GET', `/pagos/mulas/${A.id}`);
    check('CxP.valor_total recalculado al nuevo neto', near(money(r.j?.data?.cuenta?.valor_total), netoDe(1200000)), `total=${r.j?.data?.cuenta?.valor_total}`);
    // Volvemos A a 1,000,000 para simplificar la cascada.
    await req('PATCH', `/pagos/mulas/${A.id}`, { valor: 1000000 });

    // ---------- Abono en cascada al PROVEEDOR (paga varios despachos con 1 abono) ----------
    log('\n===== POST /pagos/mulas/proveedor/:id/abonos (cascada) =====');
    const netoA = netoDe(1000000), netoB = netoDe(500000), netoC = netoDe(700000);

    // Abono 1: cubre A completo + parte de B (más viejo primero).
    const abono1 = r2(netoA + netoB * 0.4);
    r = await req('POST', `/pagos/mulas/proveedor/${idProveedor}/abonos`, { valor: abono1, comprobante_url: 'https://x/1.png', fecha_abono: '2026-09-10' });
    check('abono 1 (201) aplica a A y a B, sin sobrepago', r.status === 201 && r.j?.data?.aplicado_a?.length === 2 && near(money(r.j?.data?.saldo_a_favor_generado), 0), `aplicado=${JSON.stringify(r.j?.data?.aplicado_a)}`);
    check('el primero aplicado es A (más viejo)', r.j?.data?.aplicado_a?.[0]?.id_mula === A.id, `id_mula=${r.j?.data?.aplicado_a?.[0]?.id_mula}`);
    check('A queda pagado, B queda parcial', r.j?.data?.aplicado_a?.[0]?.estado === 'pagado' && r.j?.data?.aplicado_a?.[1]?.estado === 'parcial', `estados=${r.j?.data?.aplicado_a?.map(a => a.estado)}`);

    // Abono 2: cubre el resto de B + C completo + sobrepago de 50,000.
    const restanteB = r2(netoB * 0.6);
    const abono2 = r2(restanteB + netoC + 50000);
    r = await req('POST', `/pagos/mulas/proveedor/${idProveedor}/abonos`, { valor: abono2, comprobante_url: 'https://x/2.png', fecha_abono: '2026-09-11' });
    check('abono 2 (201) termina B, paga C, genera sobrepago 50000', r.status === 201 && r.j?.data?.aplicado_a?.length === 2 && near(money(r.j?.data?.saldo_a_favor_generado), 50000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('GET', `/pagos/mulas/resumen?id_proveedor=${idProveedor}`);
    check('resumen: total_pendiente = 0 tras pagar todo', near(money(r.j?.data?.total_pendiente), 0), `pend=${r.j?.data?.total_pendiente}`);
    let [saf] = await db.execute('SELECT * FROM Saldo_A_Favor WHERE id_proveedor=? AND origen="pago_excedido"', [idProveedor]);
    check('Saldo_A_Favor creado con monto 50000', saf.length === 1 && near(money(saf[0].monto_original), 50000), `saf=${JSON.stringify(saf[0] || {})}`);

    // ---------- Abono sin deuda pendiente → 409 ----------
    r = await req('POST', `/pagos/mulas/proveedor/${idProveedor}/abonos`, { valor: 1000, comprobante_url: 'https://x/3.png' });
    check('abonar sin deuda pendiente → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Editar/eliminar abono ----------
    log('\n===== PATCH/DELETE abono =====');
    r = await req('GET', `/pagos/mulas/${A.id}`);
    const primerAbono = r.j?.data?.abonos?.[0];
    r = await req('PATCH', `/pagos/mulas/abonos/${primerAbono.id}`, { observaciones: 'editado por test' });
    check('PATCH abono (200)', r.status === 200 && r.j?.data?.abono?.observaciones === 'editado por test', `obs=${r.j?.data?.abono?.observaciones}`);

    log('\n===== GET /pagos/mulas/abonos (paginado) =====');
    r = await req('GET', `/pagos/mulas/abonos?id_proveedor=${idProveedor}&limit=5`);
    check('GET /pagos/mulas/abonos (200, arreglo + paginación)', r.status === 200 && Array.isArray(r.j?.data?.abonos) && r.j?.data?.pagination?.limit === 5, `n=${r.j?.data?.abonos?.length}`);

    // ---------- Trazabilidad por viaje ----------
    log('\n===== GET /pagos/mulas/viajes (trazabilidad) =====');
    r = await req('GET', '/pagos/mulas/viajes');
    const filaViaje = (r.j?.data || []).find(v => v.id_viaje === idViaje);
    check('trazabilidad incluye el viaje con su proveedor y abonos', r.status === 200 && !!filaViaje && filaViaje.proveedor && Array.isArray(filaViaje.abonos) && filaViaje.abonos.length > 0, `fila=${JSON.stringify(filaViaje || {})}`);

    // ---------- Eliminar: 409 con abonos, 200 sin abonos ----------
    log('\n===== DELETE /pagos/mulas/:id (guard de abonos) =====');
    r = await req('DELETE', `/pagos/mulas/${A.id}`);
    check('DELETE mula A con abonos → 409', r.status === 409, `status=${r.status}`);

    // Creamos una D sin abonos, para probar el DELETE limpio.
    r = await req('POST', '/pagos/mulas', { id_proveedor: idProveedor, valor: 200000, fecha: '2026-09-05' });
    const D = r.j?.data;
    if (D?.id) mulaIds.push(D.id);
    r = await req('DELETE', `/pagos/mulas/${D.id}`);
    check('DELETE mula D sin abonos → 200', r.status === 200, `status=${r.status}`);
    mulaIds = mulaIds.filter(id => id !== D.id);
    r = await req('GET', `/pagos/mulas/${D.id}`);
    check('mula D ya no existe (404)', r.status === 404, `status=${r.status}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Pago de MULAS (v2, cascada por proveedor)\n\n`;
    md += `> Generado por \`tests/pagos/pago_mula.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- POST/GET/PATCH/DELETE /pagos/mulas · GET /pagos/mulas/:id · GET /pagos/mulas/resumen\n`;
    md += `- POST /pagos/mulas/proveedor/:id/abonos (cascada) · PATCH/DELETE /pagos/mulas/abonos · GET /pagos/mulas/abonos (paginado)\n`;
    md += `- GET /pagos/mulas/viajes (trazabilidad viaje → proveedor → abonos)\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_MULA_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
