/**
 * Test de NÓMINA QUINCENAL + BONOS + PRÉSTAMOS↔CxP/CxC + PRESTACIONES + FICHA 360.
 * Ver NOMINA_QUINCENAL_plan.md.
 *
 *  - POST /nomina/empleados/prestamos              → ahora crea también CxP (egreso) y CxC (cobro)
 *  - POST /nomina/empleados/bonos                  → crea su propia CxP (categoría Bono empleado)
 *  - GET  /nomina/empleados/liquidaciones/preview   → cálculo sin persistir (fijo: tarifa/2)
 *  - POST /nomina/empleados/liquidaciones           → confirma: genera CxP de Nómina + descuenta cuota de préstamo (Abono_CxC)
 *  - GET  /nomina/empleados/liquidaciones           → historial
 *  - GET  /nomina/empleados/:id/prestaciones        → cesantías/prima/vacaciones/intereses estimados
 *  - GET  /nomina/empleados/:id/ficha               → agregador 360
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/nomina/nomina_quincenal.endpoints.test.mjs
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
let idEmpleado, idPrestamo, idCxpPrestamo, idCxcPrestamo, idBono, idCxpBono, idLiquidacion, idCxpNomina;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (idCxcPrestamo) await db.query('DELETE FROM Abonos_CxC WHERE id_cxc = ?', [idCxcPrestamo]);
        if (idPrestamo) await db.query('DELETE FROM Cuentas_Por_Cobrar_Relacion WHERE id_prestamo_emp = ?', [idPrestamo]);
        if (idPrestamo) await db.query('DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_prestamo_emp = ?', [idPrestamo]);
        if (idCxcPrestamo) await db.query('DELETE FROM Cuentas_Por_Cobrar WHERE id = ?', [idCxcPrestamo]);
        if (idLiquidacion) await db.query('DELETE FROM Nomina_Liquidaciones WHERE id = ?', [idLiquidacion]);
        if (idBono) await db.query('DELETE FROM Bonos_Empleado WHERE id = ?', [idBono]);
        if (idPrestamo) await db.query('DELETE FROM Prestamos_Empleados WHERE id = ?', [idPrestamo]);
        if (idCxpPrestamo) await db.query('DELETE FROM Cuentas_Por_Pagar WHERE id = ?', [idCxpPrestamo]);
        if (idCxpBono) await db.query('DELETE FROM Cuentas_Por_Pagar WHERE id = ?', [idCxpBono]);
        if (idCxpNomina) await db.query('DELETE FROM Cuentas_Por_Pagar WHERE id = ?', [idCxpNomina]);
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

    log('\n===== Setup: empleado FIJO_MENSUAL =====');
    r = await req('POST', '/nomina/empleados', { nombre: `ZZ_TEST_NOM_${RUN}`, apellido: 'PRUEBA', cc: `ZZTESTNOM${RUN}`, labor: 'PRUEBA' });
    idEmpleado = r.j?.data?.id;
    check('crea empleado (201)', r.status === 201 && !!idEmpleado, `status=${r.status}`);

    r = await req('POST', `/nomina/empleados/${idEmpleado}/salario`, { tipo_pago: 'FIJO_MENSUAL', tarifa_monto: 1000000 });
    check('crea vigencia salarial FIJO_MENSUAL 1.000.000 (201)', r.status === 201, `status=${r.status}`);

    log('\n===== Fase 1: Préstamo → CxP + CxC =====');
    r = await req('POST', '/nomina/empleados/prestamos', { id_empleado: idEmpleado, valor: 200000, cuotas: 4, concepto: `ZZ_TEST préstamo ${RUN}` });
    idPrestamo = r.j?.data?.id;
    idCxpPrestamo = r.j?.data?.id_cuenta_pagar;
    idCxcPrestamo = r.j?.data?.id_cuenta_cobrar;
    check('registra préstamo (201) con id_cuenta_pagar e id_cuenta_cobrar', r.status === 201 && !!idPrestamo && !!idCxpPrestamo && !!idCxcPrestamo, `status=${r.status} data=${JSON.stringify(r.j?.data || {})}`);

    let [[cxp]] = await db.query('SELECT cp.valor_total, cat.nombre AS categoria FROM Cuentas_Por_Pagar cp JOIN Categorias_CxP cat ON cat.id=cp.id_categoria WHERE cp.id=?', [idCxpPrestamo]);
    check('CxP del préstamo: categoría Préstamo empleado, valor 200000', cxp?.categoria === 'Préstamo empleado' && Number(cxp?.valor_total) === 200000, JSON.stringify(cxp));

    let [[cxc]] = await db.query('SELECT cc.valor_total, cc.saldo, cat.nombre AS categoria FROM Cuentas_Por_Cobrar cc JOIN Categorias_CxC cat ON cat.id=cc.id_categoria WHERE cc.id=?', [idCxcPrestamo]);
    check('CxC del préstamo: categoría Préstamo empleado, saldo 200000', cxc?.categoria === 'Préstamo empleado' && Number(cxc?.saldo) === 200000, JSON.stringify(cxc));

    r = await req('DELETE', `/nomina/empleados/prestamos/${idPrestamo}`);
    check('DELETE préstamo con CxP/CxC asociada → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    log('\n===== Fase 3: Bono → CxP =====');
    r = await req('POST', '/nomina/empleados/bonos', { id_empleado: idEmpleado, concepto: `ZZ_TEST bono ${RUN}`, valor: 50000 });
    idBono = r.j?.data?.id;
    idCxpBono = r.j?.data?.id_cuenta_pagar;
    check('registra bono (201) con id_cuenta_pagar', r.status === 201 && !!idBono && !!idCxpBono, `status=${r.status}`);

    let [[cxpBono]] = await db.query('SELECT cp.valor_total, cat.nombre AS categoria FROM Cuentas_Por_Pagar cp JOIN Categorias_CxP cat ON cat.id=cp.id_categoria WHERE cp.id=?', [idCxpBono]);
    check('CxP del bono: categoría Bono empleado, valor 50000', cxpBono?.categoria === 'Bono empleado' && Number(cxpBono?.valor_total) === 50000, JSON.stringify(cxpBono));

    r = await req('GET', `/nomina/empleados/bonos?id_empleado=${idEmpleado}`);
    check('listado de bonos incluye el creado', r.status === 200 && (r.j?.data || []).some(b => b.id === idBono), `n=${r.j?.data?.length}`);

    log('\n===== Fase 2: Preview + confirmar liquidación quincenal =====');
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const quincena = 1;

    r = await req('GET', `/nomina/empleados/liquidaciones/preview?id_empleado=${idEmpleado}&anio=${anio}&mes=${mes}&quincena=${quincena}`);
    const preview = r.j?.data;
    check('preview: bruto=500000 (fijo/2)', r.status === 200 && Number(preview?.monto_bruto) === 500000, `bruto=${preview?.monto_bruto}`);
    check('preview: descuenta cuota préstamo 50000 (200000/4)', Number(preview?.total_descuento_prestamo) === 50000, `descuento=${preview?.total_descuento_prestamo}`);
    check('preview: neto=450000', Number(preview?.monto_neto) === 450000, `neto=${preview?.monto_neto}`);
    check('preview: ya_liquidada=false', preview?.ya_liquidada === false);

    r = await req('POST', '/nomina/empleados/liquidaciones', { id_empleado: idEmpleado, anio, mes, quincena });
    idLiquidacion = r.j?.data?.id;
    idCxpNomina = r.j?.data?.id_cuenta_pagar;
    check('confirma liquidación (201)', r.status === 201 && !!idLiquidacion && !!idCxpNomina, `status=${r.status} data=${JSON.stringify(r.j?.data || {})}`);
    check('liquidación: monto_neto=450000, estado=confirmado', Number(r.j?.data?.monto_neto) === 450000 && r.j?.data?.estado === 'confirmado');

    let [[cxpNomina]] = await db.query('SELECT cp.valor_total, cat.nombre AS categoria FROM Cuentas_Por_Pagar cp JOIN Categorias_CxP cat ON cat.id=cp.id_categoria WHERE cp.id=?', [idCxpNomina]);
    check('CxP de la nómina: categoría Nómina, valor 450000', cxpNomina?.categoria === 'Nómina' && Number(cxpNomina?.valor_total) === 450000, JSON.stringify(cxpNomina));

    let [[cxcTrasDescuento]] = await db.query('SELECT valor_cobrado, saldo, estado FROM Cuentas_Por_Cobrar WHERE id=?', [idCxcPrestamo]);
    check('CxC del préstamo bajó a saldo=150000 tras el descuento_nomina', Number(cxcTrasDescuento?.saldo) === 150000 && cxcTrasDescuento?.estado === 'parcial', JSON.stringify(cxcTrasDescuento));

    let [[abonoCxc]] = await db.query("SELECT valor, metodo FROM Abonos_CxC WHERE id_cxc=? ORDER BY id DESC LIMIT 1", [idCxcPrestamo]);
    check('Abono_CxC generado con metodo=descuento_nomina, valor=50000', abonoCxc?.metodo === 'descuento_nomina' && Number(abonoCxc?.valor) === 50000, JSON.stringify(abonoCxc));

    r = await req('POST', '/nomina/empleados/liquidaciones', { id_empleado: idEmpleado, anio, mes, quincena });
    check('confirmar la misma quincena otra vez → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('GET', `/nomina/empleados/liquidaciones?id_empleado=${idEmpleado}`);
    check('historial incluye la liquidación', r.status === 200 && (r.j?.data || []).some(l => l.id === idLiquidacion), `n=${r.j?.data?.length}`);

    log('\n===== Fase 4: Prestaciones sociales =====');
    r = await req('GET', `/nomina/empleados/${idEmpleado}/prestaciones?anio=${anio}`);
    const prest = r.j?.data;
    check('prestaciones: base_mensual=1000000, meses_trabajados=1', r.status === 200 && Number(prest?.base_mensual) === 1000000 && Number(prest?.meses_trabajados) === 1, JSON.stringify(prest));
    const cesantiasEsperadas = Math.round(1000000 * 0.0833 * (1 / 12) * 100) / 100;
    check('prestaciones: cesantías ≈ base*8.33%/12', Math.abs(Number(prest?.cesantias) - cesantiasEsperadas) < 1, `cesantias=${prest?.cesantias} esperado≈${cesantiasEsperadas}`);

    log('\n===== Fase 5: Ficha 360 =====');
    r = await req('GET', `/nomina/empleados/${idEmpleado}/ficha`);
    const ficha = r.j?.data;
    check('ficha: incluye empleado con cc', r.status === 200 && ficha?.empleado?.cc === `ZZTESTNOM${RUN}`, `cc=${ficha?.empleado?.cc}`);
    check('ficha: salario_vigente FIJO_MENSUAL', ficha?.salario_vigente?.tipo_pago === 'FIJO_MENSUAL');
    check('ficha: liquidaciones incluye la confirmada', (ficha?.liquidaciones || []).some(l => l.id === idLiquidacion));
    check('ficha: bonos incluye el creado', (ficha?.bonos || []).some(b => b.id === idBono));
    check('ficha: prestamos_activos con saldo 150000', (ficha?.prestamos_activos || []).some(p => p.id === idPrestamo && Number(p.saldo_pendiente) === 150000), JSON.stringify(ficha?.prestamos_activos));
    check('ficha: prestaciones_estimadas presente', !!ficha?.prestaciones_estimadas);

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
