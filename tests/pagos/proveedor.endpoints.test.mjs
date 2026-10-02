/**
 * Test de endpoints de PROVEEDORES (la entidad real, no las categorías).
 * Antes de esto, /pagos/proveedores solo tenía CRUD de Categorias_Proveedor;
 * no existía forma de crear/listar/editar/eliminar un Proveedor real.
 *
 * Prueba:
 *  - POST   /pagos/proveedores            (crear, incluye validación de tipo)
 *  - GET    /pagos/proveedores            (listar + filtros id_categoria/tipo/estado/q)
 *  - GET    /pagos/proveedores/:id        (detalle, con nombre de categoría)
 *  - PUT    /pagos/proveedores/:id        (editar)
 *  - DELETE /pagos/proveedores/:id        (200 si no está en uso, 409 si tiene referencias)
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/pagos/proveedor.endpoints.test.mjs
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
let idProveedor, idCategoria, idProveedorEnUso, idMula, idProveedorGasolinera;
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
        if (idProveedor) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedor]);
        if (idProveedorEnUso) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedorEnUso]);
        if (idProveedorGasolinera) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedorGasolinera]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== Categoría de referencia (Transporte_Mula) =====');
    const [[cat]] = [(await db.query("SELECT id FROM Categorias_Proveedor WHERE nombre='Transporte_Mula'"))[0]];
    idCategoria = cat.id;
    check('existe categoría Transporte_Mula', !!idCategoria, `id=${idCategoria}`);

    log('\n===== POST /pagos/proveedores (crear) =====');
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_PROVEEDOR_${RUN}`, id_categoria: idCategoria, alias: `zzprov${RUN}`, telefono: '3000000000' });
    idProveedor = r.j?.data?.id;
    check('crea proveedor (201)', r.status === 201 && !!idProveedor, `status=${r.status} id=${idProveedor}`);
    check('respuesta trae categoria resuelta', r.j?.data?.categoria === 'Transporte_Mula', `categoria=${r.j?.data?.categoria}`);
    check('tipo default es general', r.j?.data?.tipo === 'general', `tipo=${r.j?.data?.tipo}`);

    r = await req('POST', '/pagos/proveedores', { alias: 'sin nombre' });
    check('crear sin nombre → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    log('\n===== tipo (gasolinera/combustible) =====');
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_GASOLINERA_${RUN}`, tipo: 'combustible' });
    idProveedorGasolinera = r.j?.data?.id;
    check('crea proveedor con tipo=combustible (201)', r.status === 201 && r.j?.data?.tipo === 'combustible', `status=${r.status} tipo=${r.j?.data?.tipo}`);

    r = await req('POST', '/pagos/proveedores', { nombre: 'tipo invalido', tipo: 'no_existe' });
    check('crear con tipo inválido → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('PUT', `/pagos/proveedores/${idProveedorGasolinera}`, { tipo: 'no_existe' });
    check('editar con tipo inválido → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    log('\n===== GET /pagos/proveedores (listar + filtros) =====');
    r = await req('GET', `/pagos/proveedores?id_categoria=${idCategoria}`);
    check('listado filtra por id_categoria e incluye el creado', r.status === 200 && (r.j?.data || []).some(p => p.id === idProveedor), `n=${r.j?.data?.length}`);
    r = await req('GET', `/pagos/proveedores?q=ZZ_TEST_PROVEEDOR_${RUN}`);
    check('listado filtra por q (nombre/alias)', r.status === 200 && r.j?.data?.length === 1 && r.j.data[0].id === idProveedor, `n=${r.j?.data?.length}`);
    r = await req('GET', `/pagos/proveedores?tipo=combustible`);
    check('listado filtra por tipo=combustible e incluye el creado, excluye el de Transporte_Mula', r.status === 200
        && (r.j?.data || []).some(p => p.id === idProveedorGasolinera)
        && !(r.j?.data || []).some(p => p.id === idProveedor),
        `n=${r.j?.data?.length}`);

    log('\n===== GET /pagos/proveedores/:id (detalle) =====');
    r = await req('GET', `/pagos/proveedores/${idProveedor}`);
    check('detalle (200) trae el proveedor creado', r.status === 200 && r.j?.data?.id === idProveedor, `nombre=${r.j?.data?.nombre}`);
    r = await req('GET', '/pagos/proveedores/9999999');
    check('detalle inexistente → 404', r.status === 404, `status=${r.status}`);

    log('\n===== PUT /pagos/proveedores/:id (editar) =====');
    r = await req('PUT', `/pagos/proveedores/${idProveedor}`, { telefono: '3111111111', estado: 'inactivo' });
    check('editar (200) refleja los cambios', r.status === 200 && r.j?.data?.telefono === '3111111111' && r.j?.data?.estado === 'inactivo', `data=${JSON.stringify(r.j?.data || {})}`);

    log('\n===== DELETE /pagos/proveedores/:id (200 sin uso, 409 con uso) =====');
    r = await req('DELETE', `/pagos/proveedores/${idProveedor}`);
    check('eliminar proveedor sin referencias → 200', r.status === 200, `status=${r.status}`);
    idProveedor = null; // ya no existe, cleanup no debe tocarlo

    // Proveedor CON referencias (una Mula real) → debe bloquear el DELETE con 409
    const [insP] = await db.query('INSERT INTO Proveedores (nombre, id_categoria, estado) VALUES (?, ?, ?)', [`ZZ_TEST_PROV_USO_${RUN}`, idCategoria, 'activo']);
    idProveedorEnUso = insP.insertId;
    r = await req('POST', '/pagos/mulas', { id_proveedor: idProveedorEnUso, valor: 100000, fecha: '2026-09-01' });
    idMula = r.j?.data?.id;
    check('setup: mula creada para el proveedor en uso', r.status === 201 && !!idMula, `id=${idMula}`);
    r = await req('DELETE', `/pagos/proveedores/${idProveedorEnUso}`);
    check('eliminar proveedor CON referencias (Mulas) → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Proveedores (entidad real)\n\n`;
    md += `> Generado por \`tests/pagos/proveedor.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_PROVEEDORES_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
