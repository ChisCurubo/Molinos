/**
 * Test de RECARGO DOMINICAL/FESTIVO (+75% de ley, Punto 2 de RECARGOS_NOCTURNO_DOMINICAL_plan.md).
 * Ver migracion_recargo_dominical_festivo_2026-10-13.sql.
 *
 * No hay catálogo de fechas festivas: el festivo se marca por turno (`es_festivo` en PUT
 * /nomina/turnos/upsert); el domingo se detecta solo.
 *
 *  - PUT  /nomina/turnos/upsert (con es_festivo=true)  → marca un turno como festivo
 *  - GET  /nomina/empleados/liquidaciones/preview      → bruto con +75% en festivo marcado
 *                                                         (POR_HORAS) y en domingo (POR_DIAS)
 *
 * Requisitos: server en :3005, migracion_recargo_dominical_festivo_2026-10-13.sql ya aplicada.
 * Uso:  node tests/nomina/recargo_dominical_festivo.endpoints.test.mjs
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
let idEmpleadoHoras, idEmpleadoDias;
const turnosHorasCreados = [];
const turnosDiasCreados = [];

function pad(n) { return String(n).padStart(2, '0'); }
function rangoQuincena() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const quincena = hoy.getDate() <= 15 ? 1 : 2;
    const desde = quincena === 1 ? `${anio}-${pad(mes)}-01` : `${anio}-${pad(mes)}-16`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const hasta = quincena === 1 ? `${anio}-${pad(mes)}-15` : `${anio}-${pad(mes)}-${pad(ultimoDia)}`;
    return { anio, mes, quincena, desde, hasta };
}
function primerDomingoEnRango(desdeStr, hastaStr) {
    let d = new Date(`${desdeStr}T00:00:00`);
    const hasta = new Date(`${hastaStr}T00:00:00`);
    while (d <= hasta) {
        if (d.getDay() === 0) return d.toISOString().slice(0, 10);
        d.setDate(d.getDate() + 1);
    }
    return null;
}
function primerNoDomingoDesde(fechaStr) {
    let d = new Date(`${fechaStr}T00:00:00`);
    while (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}
function sumarDias(fechaStr, n) {
    const d = new Date(`${fechaStr}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

async function cleanup() {
    try {
        for (const fecha of turnosHorasCreados) await req('DELETE', `/nomina/turnos/dia?id_empleado=${idEmpleadoHoras}&fecha=${fecha}`);
        for (const fecha of turnosDiasCreados) await req('DELETE', `/nomina/turnos/dia?id_empleado=${idEmpleadoDias}&fecha=${fecha}`);
        if (idEmpleadoHoras) await db.query('DELETE FROM Empleados_Salario WHERE empleado_id = ?', [idEmpleadoHoras]);
        if (idEmpleadoHoras) await db.query('DELETE FROM Empleados WHERE id = ?', [idEmpleadoHoras]);
        if (idEmpleadoDias) await db.query('DELETE FROM Empleados_Salario WHERE empleado_id = ?', [idEmpleadoDias]);
        if (idEmpleadoDias) await db.query('DELETE FROM Empleados WHERE id = ?', [idEmpleadoDias]);
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    const { anio, mes, quincena, desde, hasta } = rangoQuincena();
    const fechaFestivoMarcado = primerNoDomingoDesde(desde); // festivo NO domingo, marcado a mano
    let fechaNormal = sumarDias(fechaFestivoMarcado, 3);
    if (new Date(`${fechaNormal}T00:00:00`).getDay() === 0) fechaNormal = sumarDias(fechaNormal, 1);
    const domingo = primerDomingoEnRango(desde, hasta);
    let diaNormal = sumarDias(domingo, 2);
    if (new Date(`${diaNormal}T00:00:00`).getDay() === 0) diaNormal = sumarDias(diaNormal, 1);

    r = await req('GET', '/nomina/turnos/tipos');
    const t1 = (r.j?.data || []).find(t => t.nombre === 'TURNO 1');
    check('TURNO 1 existe en el catálogo', !!t1);

    log('\n===== Empleado POR_HORAS: turno marcado es_festivo vs turno normal =====');
    r = await req('POST', '/nomina/empleados', { nombre: `ZZ_TEST_RDF_H_${RUN}`, apellido: 'PRUEBA', cc: `ZZTESTRDFH${RUN}`, labor: 'PRUEBA' });
    idEmpleadoHoras = r.j?.data?.id;
    check('crea empleado POR_HORAS (201)', r.status === 201 && !!idEmpleadoHoras);

    r = await req('POST', `/nomina/empleados/${idEmpleadoHoras}/salario`, { tipo_pago: 'POR_HORAS', tarifa_monto: 10000 });
    check('crea vigencia salarial POR_HORAS 10.000 (201)', r.status === 201);

    r = await req('PUT', '/nomina/turnos/upsert', { id_empleado: idEmpleadoHoras, fecha: fechaFestivoMarcado, id_tipo_turno: t1.id, horas_trabajadas: 8, es_festivo: true });
    check('turno marcado es_festivo=true creado', r.status === 200 && r.j?.data?.es_festivo === 1, `status=${r.status} es_festivo=${r.j?.data?.es_festivo}`);
    turnosHorasCreados.push(fechaFestivoMarcado);

    r = await req('PUT', '/nomina/turnos/upsert', { id_empleado: idEmpleadoHoras, fecha: fechaNormal, id_tipo_turno: t1.id, horas_trabajadas: 8 });
    check('turno normal (es_festivo default false) creado', r.status === 200, `status=${r.status}`);
    turnosHorasCreados.push(fechaNormal);

    // Festivo marcado: 8×10000×(1+0+0.75)=140.000 | Normal: 8×10000×1=80.000 | Total=220.000, recargo=60.000
    r = await req('GET', `/nomina/empleados/liquidaciones/preview?id_empleado=${idEmpleadoHoras}&anio=${anio}&mes=${mes}&quincena=${quincena}`);
    const previewHoras = r.j?.data;
    check('preview POR_HORAS: bruto = 220.000 (festivo marcado 140.000 + normal 80.000)',
        r.status === 200 && Number(previewHoras?.monto_bruto) === 220000,
        `bruto=${previewHoras?.monto_bruto}`);
    check('preview POR_HORAS: total_recargo_dominical_festivo = 60.000',
        Number(previewHoras?.total_recargo_dominical_festivo) === 60000,
        `recargo=${previewHoras?.total_recargo_dominical_festivo}`);

    const detFestivo = (previewHoras?.detalle_turnos || []).find(d => d.fecha === fechaFestivoMarcado);
    const detNormalHoras = (previewHoras?.detalle_turnos || []).find(d => d.fecha === fechaNormal);
    check('detalle_turnos: turno festivo marcado con recargo_pct_diurno=75 y monto=140.000',
        detFestivo?.recargo_pct_diurno === 75 && Number(detFestivo?.monto) === 140000 && detFestivo?.es_festivo === true,
        JSON.stringify(detFestivo));
    check('detalle_turnos: turno normal con recargo_pct_diurno=0 y monto=80.000',
        detNormalHoras?.recargo_pct_diurno === 0 && Number(detNormalHoras?.monto) === 80000 && detNormalHoras?.es_festivo === false,
        JSON.stringify(detNormalHoras));

    log('\n===== Empleado POR_DIAS: día domingo (automático) vs día normal =====');
    r = await req('POST', '/nomina/empleados', { nombre: `ZZ_TEST_RDF_D_${RUN}`, apellido: 'PRUEBA', cc: `ZZTESTRDFD${RUN}`, labor: 'PRUEBA' });
    idEmpleadoDias = r.j?.data?.id;
    check('crea empleado POR_DIAS (201)', r.status === 201 && !!idEmpleadoDias);

    r = await req('POST', `/nomina/empleados/${idEmpleadoDias}/salario`, { tipo_pago: 'POR_DIAS', tarifa_monto: 50000 });
    check('crea vigencia salarial POR_DIAS 50.000 (201)', r.status === 201);

    r = await req('PUT', '/nomina/turnos/upsert', { id_empleado: idEmpleadoDias, fecha: domingo, id_tipo_turno: t1.id, horas_trabajadas: 8 });
    check('turno en domingo creado (sin marcar es_festivo, se detecta solo)', r.status === 200, `status=${r.status} fecha=${domingo}`);
    turnosDiasCreados.push(domingo);

    r = await req('PUT', '/nomina/turnos/upsert', { id_empleado: idEmpleadoDias, fecha: diaNormal, id_tipo_turno: t1.id, horas_trabajadas: 8 });
    check('turno en día normal creado', r.status === 200, `status=${r.status} fecha=${diaNormal}`);
    turnosDiasCreados.push(diaNormal);

    // Domingo: 50000×1.75=87.500 | Normal: 50000 | Total=137.500, recargo=37.500
    r = await req('GET', `/nomina/empleados/liquidaciones/preview?id_empleado=${idEmpleadoDias}&anio=${anio}&mes=${mes}&quincena=${quincena}`);
    const previewDias = r.j?.data;
    check('preview POR_DIAS: bruto = 137.500 (domingo 87.500 + normal 50.000)',
        r.status === 200 && Number(previewDias?.monto_bruto) === 137500,
        `bruto=${previewDias?.monto_bruto}`);
    check('preview POR_DIAS: total_recargo_dominical_festivo = 37.500',
        Number(previewDias?.total_recargo_dominical_festivo) === 37500,
        `recargo=${previewDias?.total_recargo_dominical_festivo}`);

    const detDomingo = (previewDias?.detalle_turnos || []).find(d => d.fecha === domingo);
    const detNormalDias = (previewDias?.detalle_turnos || []).find(d => d.fecha === diaNormal);
    check('detalle_turnos: domingo con recargo_pct_diurno=75, horas_trabajadas=null, monto=87.500',
        detDomingo?.recargo_pct_diurno === 75 && detDomingo?.horas_trabajadas === null && Number(detDomingo?.monto) === 87500 && detDomingo?.es_domingo === true,
        JSON.stringify(detDomingo));
    check('detalle_turnos: día normal con recargo_pct_diurno=0, monto=50.000',
        detNormalDias?.recargo_pct_diurno === 0 && Number(detNormalDias?.monto) === 50000,
        JSON.stringify(detNormalDias));

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
