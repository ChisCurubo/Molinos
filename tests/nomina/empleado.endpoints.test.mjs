/**
 * Test de endpoints de EMPLEADOS + SALARIO (versionado) + PRESTAMOS DE EMPLEADO.
 *
 *  - POST/GET/PUT/PATCH/DELETE /nomina/empleados (CRUD completo, PATCH nuevo 2026-09-19)
 *  - POST/GET /nomina/empleados/:id/salario, GET .../historial (versionado activo=1, nuevo)
 *  - PUT/PATCH/DELETE /nomina/empleados/salario/:idSalario (nuevo)
 *  - POST/GET/PUT/PATCH/DELETE /nomina/empleados/prestamos (CRUD completo, GET/DELETE nuevos)
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/nomina/empleado.endpoints.test.mjs
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
let idEmpleado, idSalario1, idSalario2, idPrestamo;
async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (idPrestamo) await db.query('DELETE FROM Prestamos_Empleados WHERE id = ?', [idPrestamo]);
        if (idEmpleado) await db.query('DELETE FROM Empleados_Salario WHERE empleado_id = ?', [idEmpleado]);
        if (idEmpleado) await db.query('DELETE FROM Empleados WHERE id = ?', [idEmpleado]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== CRUD Empleado =====');
    r = await req('POST', '/nomina/empleados', { nombre: `ZZ_TEST_EMP_${RUN}`, cc: `ZZTEST${RUN}`, labor: 'PRUEBA' });
    idEmpleado = r.j?.data?.id;
    check('crea empleado (201)', r.status === 201 && !!idEmpleado, `status=${r.status} id=${idEmpleado}`);

    r = await req('GET', `/nomina/empleados/${idEmpleado}`);
    check('detalle (200)', r.status === 200 && r.j?.data?.id === idEmpleado, `nombre=${r.j?.data?.nombre}`);

    r = await req('PUT', `/nomina/empleados/${idEmpleado}`, { labor: 'PRUEBA_PUT' });
    check('PUT actualiza', r.status === 200 && r.j?.data?.labor === 'PRUEBA_PUT', `labor=${r.j?.data?.labor}`);

    r = await req('PATCH', `/nomina/empleados/${idEmpleado}`, { apellido: 'PATCHEADO' });
    check('PATCH actualiza parcial (nuevo)', r.status === 200 && r.j?.data?.apellido === 'PATCHEADO' && r.j?.data?.labor === 'PRUEBA_PUT', `data=${JSON.stringify(r.j?.data || {})}`);

    r = await req('GET', '/nomina/empleados');
    check('listado incluye el creado', r.status === 200 && (r.j?.data || []).some(e => e.id === idEmpleado), `n=${r.j?.data?.length}`);

    log('\n===== Empleados_Salario (versionado) =====');
    r = await req('POST', `/nomina/empleados/${idEmpleado}/salario`, { tipo_pago: 'FIJO_MENSUAL', tarifa_monto: 1500000 });
    idSalario1 = r.j?.data?.id;
    check('crea 1ra vigencia (201) activo=1', r.status === 201 && !!idSalario1 && Number(r.j?.data?.activo) === 1, `status=${r.status}`);

    r = await req('POST', `/nomina/empleados/${idEmpleado}/salario`, { tipo_pago: 'POR_DIAS', tarifa_monto: 60000 });
    idSalario2 = r.j?.data?.id;
    check('crea 2da vigencia (201) activo=1', r.status === 201 && !!idSalario2 && Number(r.j?.data?.activo) === 1, `status=${r.status}`);

    r = await req('GET', `/nomina/empleados/${idEmpleado}/salario`);
    check('vigente devuelve solo la 2da', r.status === 200 && r.j?.data?.id === idSalario2 && r.j?.data?.tipo_pago === 'POR_DIAS', `data=${JSON.stringify(r.j?.data || {})}`);

    r = await req('GET', `/nomina/empleados/${idEmpleado}/salario/historial`);
    const historial = r.j?.data || [];
    const v1 = historial.find(v => v.id === idSalario1);
    check('historial trae ambas, la 1ra quedó activo=0', r.status === 200 && historial.length === 2 && v1 && Number(v1.activo) === 0, `n=${historial.length}`);

    r = await req('POST', `/nomina/empleados/${idEmpleado}/salario`, { tipo_pago: 'INVALIDO', tarifa_monto: 100 });
    check('tipo_pago inválido → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('PUT', `/nomina/empleados/salario/${idSalario2}`, { tarifa_monto: 65000 });
    check('editar vigencia puntual (sin re-versionar)', r.status === 200 && Number(r.j?.data?.tarifa_monto) === 65000, `tarifa=${r.j?.data?.tarifa_monto}`);

    r = await req('DELETE', `/nomina/empleados/salario/${idSalario1}`);
    check('eliminar vigencia histórica → 200', r.status === 200, `status=${r.status}`);
    idSalario1 = null;

    log('\n===== Prestamos_Empleados =====');
    r = await req('POST', '/nomina/empleados/prestamos', { id_empleado: idEmpleado, valor: 500000, concepto: `ZZ_TEST_PRESTAMO_${RUN}` });
    idPrestamo = r.j?.data?.id;
    check('crea préstamo (201)', r.status === 201 && !!idPrestamo, `status=${r.status}`);

    r = await req('GET', `/nomina/empleados/prestamos?id_empleado=${idEmpleado}`);
    check('listAll filtra por id_empleado', r.status === 200 && (r.j?.data || []).some(p => p.id === idPrestamo), `n=${r.j?.data?.length}`);

    r = await req('GET', `/nomina/empleados/prestamos/detalle/${idPrestamo}`);
    check('getById (nuevo)', r.status === 200 && r.j?.data?.id === idPrestamo, `data=${JSON.stringify(r.j?.data || {})}`);

    r = await req('GET', `/nomina/empleados/prestamos/${idEmpleado}`);
    check('ruta vieja por empleado sigue viva', r.status === 200 && (r.j?.data || []).some(p => p.id === idPrestamo), `n=${r.j?.data?.length}`);

    r = await req('PATCH', `/nomina/empleados/prestamos/${idPrestamo}`, { concepto: 'PATCHEADO' });
    check('PATCH préstamo (nuevo)', r.status === 200 && r.j?.data?.concepto === 'PATCHEADO', `concepto=${r.j?.data?.concepto}`);

    r = await req('DELETE', `/nomina/empleados/prestamos/${idPrestamo}`);
    check('eliminar préstamo con CxP/CxC asociada → 409 (2026-09-21: ya no es un error de captura, tiene egreso/cobro real)', r.status === 409, `status=${r.status}`);

    r = await req('DELETE', `/nomina/empleados/prestamos/9999999`);
    check('eliminar préstamo inexistente → 404', r.status === 404, `status=${r.status}`);

    // El préstamo de esta prueba ya generó su CxP/CxC (Fase 1 de NOMINA_QUINCENAL_plan.md),
    // así que ya no se puede borrar vía API. Se limpia por DB para poder demostrar, más abajo,
    // que borrar el Empleado sigue funcionando cuando lo único que queda es su historial de salario.
    const [cxpRel] = await db.query('SELECT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_prestamo_emp = ?', [idPrestamo]);
    const [cxcRel] = await db.query('SELECT id_cxc FROM Cuentas_Por_Cobrar_Relacion WHERE id_prestamo_emp = ?', [idPrestamo]);
    await db.query('SET FOREIGN_KEY_CHECKS=0');
    for (const { id_cuenta_pagar } of cxpRel) await db.query('DELETE FROM Cuentas_Por_Pagar WHERE id = ?', [id_cuenta_pagar]);
    for (const { id_cxc } of cxcRel) await db.query('DELETE FROM Cuentas_Por_Cobrar WHERE id = ?', [id_cxc]);
    await db.query('DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_prestamo_emp = ?', [idPrestamo]);
    await db.query('DELETE FROM Cuentas_Por_Cobrar_Relacion WHERE id_prestamo_emp = ?', [idPrestamo]);
    await db.query('DELETE FROM Prestamos_Empleados WHERE id = ?', [idPrestamo]);
    await db.query('SET FOREIGN_KEY_CHECKS=1');
    idPrestamo = null;

    log('\n===== DELETE Empleado (limpieza vía API) =====');
    r = await req('DELETE', `/nomina/empleados/${idEmpleado}`);
    check('eliminar empleado (cascada de salario) → 200', r.status === 200, `status=${r.status}`);
    idEmpleado = null;

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Empleados / Salario / Prestamos_Empleados\n\n`;
    md += `> Generado por \`tests/nomina/empleado.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_EMPLEADO_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
