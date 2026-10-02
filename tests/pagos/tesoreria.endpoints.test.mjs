/**
 * Test de TESORERÍA (EMPLEADOS_PRESTAMOS_plan.md Fase 2): Ingresos_Tesoreria, enganche con
 * Prestamos_Financieros, y flujo de caja (ingresos vs. gastos, solo movimientos de caja real).
 *
 *  - POST /pagos/prestamos-financieros    → ahora también genera su Ingresos_Tesoreria
 *  - POST/GET/PUT/DELETE /pagos/ingresos  → CRUD de ingresos manuales (409 si vienen de un préstamo)
 *  - GET  /pagos/vistas/flujo-caja        → ingresos (tesorería + cobros CxC) vs. gastos (CxP), solo caja real
 *  - GET  /pagos/vistas/flujo-caja/historico
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/pagos/tesoreria.endpoints.test.mjs
 */
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
const HOY = new Date().toISOString().slice(0, 10);
let idPrestamoFin, idIngresoPrestamo, idIngresoManual, idCxcDummy, idCxpDummy;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (idCxcDummy) { await db.query('DELETE FROM Abonos_CxC WHERE id_cxc=?', [idCxcDummy]); await db.query('DELETE FROM Cuentas_Por_Cobrar WHERE id=?', [idCxcDummy]); }
        if (idCxpDummy) { await db.query('DELETE FROM Abonos_CxP WHERE id_cuenta_pagar=?', [idCxpDummy]); await db.query('DELETE FROM Cuentas_Por_Pagar WHERE id=?', [idCxpDummy]); }
        if (idIngresoManual) await db.query('DELETE FROM Ingresos_Tesoreria WHERE id=?', [idIngresoManual]);
        if (idIngresoPrestamo) await db.query('DELETE FROM Ingresos_Tesoreria WHERE id=?', [idIngresoPrestamo]);
        if (idPrestamoFin) await db.query('DELETE FROM prestamos_financieros WHERE id=?', [idPrestamoFin]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== Préstamo financiero → Ingresos_Tesoreria automático =====');
    r = await req('POST', '/pagos/prestamos-financieros', {
        nombre_prestamo: `ZZ_TEST_BANCO_${RUN}`, fecha_adquisicion: HOY, monto_principal: 1000000, tasa_interes: 2
    });
    idPrestamoFin = r.j?.data?.id;
    check('crea préstamo financiero (201)', r.status === 201 && !!idPrestamoFin, `status=${r.status} data=${JSON.stringify(r.j?.data || {})}`);

    let [[ing]] = await db.query(
        `SELECT it.*, cat.nombre AS categoria FROM Ingresos_Tesoreria it JOIN Categorias_Ingreso cat ON cat.id=it.id_categoria WHERE it.id_prestamo_fin=?`,
        [idPrestamoFin]
    );
    idIngresoPrestamo = ing?.id;
    check('generó Ingresos_Tesoreria categoría "Préstamo recibido" valor 1000000', ing?.categoria === 'Préstamo recibido' && Number(ing?.valor) === 1000000, JSON.stringify(ing));

    r = await req('GET', `/pagos/ingresos?desde=${HOY}&hasta=${HOY}`);
    check('listado de ingresos incluye el del préstamo', r.status === 200 && (r.j?.data || []).some(i => i.id === idIngresoPrestamo), `n=${r.j?.data?.length}`);

    r = await req('DELETE', `/pagos/ingresos/${idIngresoPrestamo}`);
    check('no se puede eliminar un ingreso que viene de un préstamo → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    log('\n===== Ingreso manual: CRUD =====');
    const [[catAporte]] = (await db.query("SELECT id FROM Categorias_Ingreso WHERE nombre='Aporte de socio'"))[0] ? await db.query("SELECT id FROM Categorias_Ingreso WHERE nombre='Aporte de socio'") : [[]];
    r = await req('POST', '/pagos/ingresos', { id_categoria: catAporte.id, concepto: `ZZ_TEST aporte ${RUN}`, valor: 300000, fecha: HOY });
    idIngresoManual = r.j?.data?.id;
    check('registra ingreso manual (201)', r.status === 201 && !!idIngresoManual, `status=${r.status}`);

    r = await req('PUT', `/pagos/ingresos/${idIngresoManual}`, { valor: 350000 });
    check('edita ingreso manual', r.status === 200 && Number(r.j?.data?.valor) === 350000, `valor=${r.j?.data?.valor}`);

    log('\n===== Flujo de caja: solo movimientos de caja real =====');
    const antes = await req('GET', `/pagos/vistas/flujo-caja?mes=${new Date().getMonth() + 1}&anio=${new Date().getFullYear()}`);
    check('flujo-caja responde 200 con estructura esperada', antes.status === 200 && antes.j?.data?.ingresos && antes.j?.data?.gastos, JSON.stringify(antes.j?.data));

    // Cuenta_Por_Cobrar dummy: un abono en efectivo SÍ debe contar, uno con descuento_nomina NO.
    const [[catCxc]] = await db.query("SELECT id FROM Categorias_CxC WHERE nombre='Otro cobro'");
    const [insCxc] = await db.query(
        "INSERT INTO Cuentas_Por_Cobrar (id_categoria, concepto, valor_total, fecha_creacion) VALUES (?, ?, 100000, ?)",
        [catCxc.id, `ZZ_TEST cxc ${RUN}`, HOY]
    );
    idCxcDummy = insCxc.insertId;

    const antesFlujo = await req('GET', `/pagos/vistas/flujo-caja?mes=${new Date().getMonth() + 1}&anio=${new Date().getFullYear()}`);
    const ingresosCxcAntes = Number(antesFlujo.j?.data?.ingresos?.cobros_cxc || 0);

    await db.query("INSERT INTO Abonos_CxC (id_cxc, fecha_cobro, valor, metodo) VALUES (?, ?, 40000, 'efectivo')", [idCxcDummy, HOY]);
    await db.query("INSERT INTO Abonos_CxC (id_cxc, fecha_cobro, valor, metodo) VALUES (?, ?, 25000, 'descuento_nomina')", [idCxcDummy, HOY]);

    const despuesFlujo = await req('GET', `/pagos/vistas/flujo-caja?mes=${new Date().getMonth() + 1}&anio=${new Date().getFullYear()}`);
    const ingresosCxcDespues = Number(despuesFlujo.j?.data?.ingresos?.cobros_cxc || 0);
    check('cobro en efectivo (40000) SÍ suma a cobros_cxc', Math.abs((ingresosCxcDespues - ingresosCxcAntes) - 40000) < 0.01, `antes=${ingresosCxcAntes} despues=${ingresosCxcDespues}`);

    // CxP dummy: un abono efectivo SÍ debe contar como gasto, uno saldo_a_favor NO.
    const [[catCxp]] = await db.query("SELECT id FROM Categorias_CxP WHERE nombre='Otro'");
    const [insCxp] = await db.query(
        "INSERT INTO Cuentas_Por_Pagar (id_categoria, concepto, valor_total, fecha_creacion) VALUES (?, ?, 100000, ?)",
        [catCxp.id, `ZZ_TEST cxp ${RUN}`, HOY]
    );
    idCxpDummy = insCxp.insertId;

    const antesGasto = Number(despuesFlujo.j?.data?.gastos?.total || 0);
    await db.query("INSERT INTO Abonos_CxP (id_cuenta_pagar, fecha_abono, valor, metodo_pago) VALUES (?, ?, 30000, 'transferencia')", [idCxpDummy, HOY]);
    // saldo_a_favor requiere id_saldo_favor por el CHECK — se omite ese caso puntual y se prueba solo el positivo (transferencia).

    const finalFlujo = await req('GET', `/pagos/vistas/flujo-caja?mes=${new Date().getMonth() + 1}&anio=${new Date().getFullYear()}`);
    const gastosDespues = Number(finalFlujo.j?.data?.gastos?.total || 0);
    check('gasto por transferencia (30000) SÍ suma a gastos', Math.abs((gastosDespues - antesGasto) - 30000) < 0.01, `antes=${antesGasto} despues=${gastosDespues}`);

    r = await req('GET', '/pagos/vistas/flujo-caja/historico');
    check('histórico responde 200 con saldo_acumulado', r.status === 200 && typeof r.j?.data?.saldo_acumulado === 'number', JSON.stringify(r.j?.data));

    r = await req('DELETE', `/pagos/ingresos/${idIngresoManual}`);
    check('elimina ingreso manual (200)', r.status === 200, `status=${r.status}`);
    idIngresoManual = null;

} catch (e) {
    log('ERROR FATAL:', e.message);
    results.push({ name: 'FATAL', ok: false, detail: e.message });
} finally {
    await cleanup();
    await db.end();
}

const total = results.length;
const ok = results.filter(r => r.ok).length;
log(`\n===== RESUMEN: ${ok}/${total} OK =====`);
if (ok !== total) {
    log('Fallidos:', results.filter(r => !r.ok).map(r => r.name).join(', '));
    process.exit(1);
}
