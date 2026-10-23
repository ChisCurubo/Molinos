/**
 * Test de endpoints de ALQUILER (CRUD del contrato + catálogo de tipos) y
 * PAGO DE ALQUILER (CxP 1:1 por alquiler, sin cascada mensual, sin saldo a favor).
 *
 *  - GET/POST/PUT/DELETE /pagos/alquileres/tipos      (catálogo, ya existía)
 *  - GET/POST            /pagos/alquileres            (listar/crear alquiler)
 *  - GET/PUT/DELETE      /pagos/alquileres/:id         (detalle/editar/anular)
 *  - GET  /pagos/alquileres/:id/estado-pago            (crea la CxP perezosamente)
 *  - POST /pagos/alquileres/:id/abonos                 (abono parcial o pago completo)
 *  - PATCH/DELETE /pagos/alquileres/abonos/:idAbono
 *  - GET  /pagos/alquileres/abonos                     (paginado)
 *
 * Requisitos: server en :3005 (sin migración adicional — todo ya existía en la BD).
 * Uso:  node tests/pagos/pago_alquiler.endpoints.test.mjs
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
let idProveedor, idTipo, idAlquiler1, idAlquiler2, idAlquilerSinProveedor;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        const alquileres = [idAlquiler1, idAlquiler2, idAlquilerSinProveedor].filter(Boolean);
        if (alquileres.length) {
            const inA = alquileres.map(() => '?').join(',');
            const [rel] = await db.query(`SELECT DISTINCT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_alquiler IN (${inA})`, alquileres);
            const cuentas = rel.map(r => r.id_cuenta_pagar);
            if (cuentas.length) {
                const inCu = cuentas.map(() => '?').join(',');
                await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
            }
            await db.query(`DELETE FROM Alquileres WHERE id IN (${inA})`, alquileres);
        }
        if (idTipo) await db.query('DELETE FROM Tipos_Alquiler WHERE id = ?', [idTipo]);
        if (idProveedor) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedor]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    // ---------- Setup aislado: proveedor + tipo de alquiler de prueba ----------
    log('\n===== SETUP (proveedor + tipo de prueba) =====');
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_ARRENDADOR_${RUN}`, alias: 'zzarr', estado: 'activo' });
    idProveedor = r.j?.data?.id ?? r.j?.id;
    check('crea proveedor de prueba', r.status === 201 && !!idProveedor, `id=${idProveedor}`);

    r = await req('POST', '/pagos/alquileres/tipos', { nombre: `ZZ_TEST_TIPO_${RUN}` });
    idTipo = r.j?.data?.id;
    check('crea tipo de alquiler de prueba', r.status === 201 && !!idTipo, `id=${idTipo}`);

    // ---------- CRUD de Tipos_Alquiler (catálogo ya existente) ----------
    log('\n===== CRUD TIPOS DE ALQUILER =====');
    r = await req('GET', '/pagos/alquileres/tipos');
    check('GET /tipos lista e incluye el tipo creado', r.status === 200 && (r.j?.data || []).some(t => t.id === idTipo), `n=${r.j?.data?.length}`);
    r = await req('GET', `/pagos/alquileres/tipos/${idTipo}`);
    check('GET /tipos/:id devuelve el tipo', r.status === 200 && r.j?.data?.id === idTipo);
    r = await req('PUT', `/pagos/alquileres/tipos/${idTipo}`, { nombre: `ZZ_TEST_TIPO_EDITADO_${RUN}` });
    check('PUT /tipos/:id edita el nombre', r.status === 200 && r.j?.data?.nombre === `ZZ_TEST_TIPO_EDITADO_${RUN}`, `nombre=${r.j?.data?.nombre}`);

    // ---------- CRUD de Alquiler (contrato real) ----------
    log('\n===== CRUD ALQUILER =====');
    r = await req('POST', '/pagos/alquileres', { id_tipo: idTipo, id_proveedor: idProveedor, fecha_inicio: '2026-10-01', concepto: `ZZ_TEST_ALQUILER_${RUN}`, valor: 1000000 });
    idAlquiler1 = r.j?.data?.id;
    check('POST /alquileres crea el alquiler', r.status === 201 && !!idAlquiler1 && money(r.j?.data?.valor) === 1000000, `id=${idAlquiler1} valor=${r.j?.data?.valor}`);

    r = await req('GET', `/pagos/alquileres/${idAlquiler1}`);
    check('GET /alquileres/:id devuelve el alquiler', r.status === 200 && r.j?.data?.concepto === `ZZ_TEST_ALQUILER_${RUN}`);

    r = await req('GET', '/pagos/alquileres');
    check('GET /alquileres lista e incluye el creado', r.status === 200 && (r.j?.data || []).some(a => a.id === idAlquiler1), `n=${r.j?.data?.length}`);

    r = await req('PUT', `/pagos/alquileres/${idAlquiler1}`, { valor: 1200000 });
    check('PUT /alquileres/:id edita el valor', r.status === 200 && money(r.j?.data?.valor) === 1200000, `valor=${r.j?.data?.valor}`);

    // Revertimos a 1,000,000 para que el flujo de pago de abajo use números redondos
    r = await req('PUT', `/pagos/alquileres/${idAlquiler1}`, { valor: 1000000 });
    check('PUT /alquileres/:id revierte el valor a 1000000', r.status === 200 && money(r.j?.data?.valor) === 1000000);

    // ---------- Alquiler sin proveedor (para probar el guard de pago) ----------
    r = await req('POST', '/pagos/alquileres', { id_tipo: idTipo, fecha_inicio: '2026-10-01', concepto: `ZZ_TEST_SIN_PROVEEDOR_${RUN}`, valor: 500000 });
    idAlquilerSinProveedor = r.j?.data?.id;
    check('POST /alquileres sin id_proveedor también se crea (columna opcional)', r.status === 201 && !!idAlquilerSinProveedor, `id=${idAlquilerSinProveedor}`);

    // ---------- Pago: estado inicial (crea la CxP perezosamente) ----------
    log('\n===== ESTADO DE PAGO INICIAL =====');
    r = await req('GET', `/pagos/alquileres/${idAlquiler1}/estado-pago`);
    check('estado-pago inicial: pendiente, saldo=valor_total, sin abonos', r.status === 200 && r.j?.data?.estado === 'pendiente' && near(r.j?.data?.saldo, 1000000) && (r.j?.data?.abonos || []).length === 0, `data=${JSON.stringify(r.j?.data)}`);

    // Guard: alquiler sin proveedor no se puede pagar
    r = await req('POST', `/pagos/alquileres/${idAlquilerSinProveedor}/abonos`, { valor: 100000, comprobante_url: 'https://x/0.png' });
    check('abonar a alquiler sin proveedor → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Validaciones del abono ----------
    log('\n===== VALIDACIONES DE ABONO =====');
    r = await req('POST', `/pagos/alquileres/${idAlquiler1}/abonos`, { valor: 0, comprobante_url: 'https://x/a.png' });
    check('abono valor=0 → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', `/pagos/alquileres/${idAlquiler1}/abonos`, { valor: 100000 });
    check('abono sin comprobante_url → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', `/pagos/alquileres/${idAlquiler1}/abonos`, { valor: 1500000, comprobante_url: 'https://x/b.png' });
    check('abono mayor al saldo pendiente → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Abono parcial ----------
    log('\n===== ABONO PARCIAL =====');
    r = await req('POST', `/pagos/alquileres/${idAlquiler1}/abonos`, { valor: 400000, fecha_abono: '2026-10-05', metodo_pago: 'transferencia', comprobante_url: 'https://x/c.png' });
    const idAbono1 = r.j?.data?.id_abono;
    check('abono parcial de 400000 → 201, cuenta queda parcial', r.status === 201 && !!idAbono1 && r.j?.data?.cuenta?.estado === 'parcial' && near(r.j?.data?.cuenta?.saldo, 600000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('GET', `/pagos/alquileres/${idAlquiler1}/estado-pago`);
    check('estado-pago refleja el abono parcial (1 abono, saldo=600000)', r.status === 200 && r.j?.data?.estado === 'parcial' && near(r.j?.data?.saldo, 600000) && (r.j?.data?.abonos || []).length === 1, `data=${JSON.stringify(r.j?.data)}`);

    // ---------- Abono que completa el pago ----------
    log('\n===== ABONO QUE COMPLETA EL PAGO =====');
    r = await req('POST', `/pagos/alquileres/${idAlquiler1}/abonos`, { valor: 600000, fecha_abono: '2026-10-10', metodo_pago: 'efectivo', comprobante_url: 'https://x/d.png' });
    const idAbono2 = r.j?.data?.id_abono;
    check('abono final de 600000 → 201, cuenta queda pagada', r.status === 201 && !!idAbono2 && r.j?.data?.cuenta?.estado === 'pagado' && near(r.j?.data?.cuenta?.saldo, 0), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('POST', `/pagos/alquileres/${idAlquiler1}/abonos`, { valor: 1, comprobante_url: 'https://x/e.png' });
    check('abonar a alquiler ya pagado → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Listado paginado de abonos ----------
    log('\n===== LISTADO DE ABONOS =====');
    r = await req('GET', `/pagos/alquileres/abonos?id_alquiler=${idAlquiler1}`);
    check('GET /abonos?id_alquiler incluye los 2 abonos', r.status === 200 && (r.j?.data?.abonos || []).length === 2, `n=${r.j?.data?.abonos?.length}`);

    // ---------- Editar abono ----------
    log('\n===== EDITAR ABONO =====');
    r = await req('PATCH', `/pagos/alquileres/abonos/${idAbono1}`, { valor: 350000 });
    check('PATCH abono recalcula la cuenta (vuelve a parcial)', r.status === 200 && r.j?.data?.cuenta?.estado === 'parcial' && near(r.j?.data?.cuenta?.saldo, 50000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('PATCH', `/pagos/alquileres/abonos/${idAbono1}`, { valor: 999999999 });
    check('PATCH abono que excede el total → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    // deja la cuenta pagada de nuevo para la siguiente sección
    r = await req('PATCH', `/pagos/alquileres/abonos/${idAbono1}`, { valor: 400000 });
    check('PATCH abono vuelve a 400000 (cuenta pagada otra vez)', r.status === 200 && r.j?.data?.cuenta?.estado === 'pagado', `estado=${r.j?.data?.cuenta?.estado}`);

    // ---------- Eliminar abono ----------
    log('\n===== ELIMINAR ABONO =====');
    r = await req('DELETE', `/pagos/alquileres/abonos/${idAbono2}`);
    check('DELETE abono final → 200, cuenta vuelve a parcial', r.status === 200 && r.j?.data?.estado === 'parcial' && near(r.j?.data?.saldo, 600000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('DELETE', `/pagos/alquileres/abonos/999999999`);
    check('DELETE abono inexistente → 404', r.status === 404, `status=${r.status}`);

    // ---------- Anular alquiler (borrado lógico) ----------
    log('\n===== ANULAR ALQUILER (BORRADO LÓGICO) =====');
    r = await req('POST', '/pagos/alquileres', { id_tipo: idTipo, id_proveedor: idProveedor, fecha_inicio: '2026-10-02', concepto: `ZZ_TEST_ALQUILER2_${RUN}`, valor: 200000 });
    idAlquiler2 = r.j?.data?.id;
    check('crea 2do alquiler para probar anulación', r.status === 201 && !!idAlquiler2, `id=${idAlquiler2}`);

    r = await req('DELETE', `/pagos/alquileres/${idAlquiler2}`);
    check('DELETE /alquileres/:id anula (200)', r.status === 200, `status=${r.status}`);

    r = await req('GET', '/pagos/alquileres');
    check('alquiler anulado ya no aparece en el listado', !(r.j?.data || []).some(a => a.id === idAlquiler2), `n=${r.j?.data?.length}`);

    const [row] = await db.query('SELECT deleted_at FROM Alquileres WHERE id = ?', [idAlquiler2]);
    check('deleted_at quedó con fecha en BD (no se borró el registro)', !!row[0]?.deleted_at, `deleted_at=${row[0]?.deleted_at}`);

    r = await req('DELETE', `/pagos/alquileres/${idAlquiler2}`);
    check('anular dos veces el mismo alquiler → 404', r.status === 404, `status=${r.status}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Alquiler: CRUD + pago (CxP 1:1)\n\n`;
    md += `> Generado por \`tests/pagos/pago_alquiler.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- GET/POST/PUT/DELETE /pagos/alquileres/tipos\n`;
    md += `- GET/POST /pagos/alquileres · GET/PUT/DELETE /pagos/alquileres/:id\n`;
    md += `- GET /pagos/alquileres/:id/estado-pago · POST /pagos/alquileres/:id/abonos\n`;
    md += `- PATCH/DELETE /pagos/alquileres/abonos/:idAbono · GET /pagos/alquileres/abonos\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_PAGO_ALQUILER_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
