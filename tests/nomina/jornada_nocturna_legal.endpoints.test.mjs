/**
 * Test de JORNADA NOCTURNA LEGAL (histórico del corte + partición de horas en nómina).
 * Ver RECARGOS_NOCTURNO_DOMINICAL_plan.md (Camino B) y
 * migracion_jornada_nocturna_legal_2026-10-13.sql.
 *
 *  - GET  /nomina/jornada-nocturna-legal            → histórico (sembrado por la migración)
 *  - POST /nomina/jornada-nocturna-legal             → registrar un nuevo corte
 *  - GET  /nomina/empleados/liquidaciones/preview    → bruto POR_HORAS con 3 turnos (mañana/
 *                                                       tarde/noche) partidos por el corte vigente
 *
 * Requisitos: server en :3005, migracion_jornada_nocturna_legal_2026-10-13.sql ya aplicada.
 * Uso:  node tests/nomina/jornada_nocturna_legal.endpoints.test.mjs
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
let idEmpleado, idJornadaNueva;
const turnosCreados = [];

async function cleanup() {
    try {
        if (idJornadaNueva) await db.query('DELETE FROM Jornada_Nocturna_Legal WHERE id = ?', [idJornadaNueva]);
        for (const fecha of turnosCreados) await db.query('DELETE FROM Turnos WHERE id_empleado = ? AND fecha = ?', [idEmpleado, fecha]);
        if (idEmpleado) await db.query('DELETE FROM Empleados_Salario WHERE empleado_id = ?', [idEmpleado]);
        if (idEmpleado) await db.query('DELETE FROM Empleados WHERE id = ?', [idEmpleado]);
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== Histórico de jornada nocturna legal =====');
    r = await req('GET', '/nomina/jornada-nocturna-legal');
    const historial = r.j?.data || [];
    check('GET histórico (200), incluye la semilla de 2025-07-15 → 19:00',
        r.status === 200 && historial.some(j => String(j.vigente_desde).slice(0, 10) === '2025-07-15' && String(j.hora_inicio_nocturno) === '19:00:00'),
        `n=${historial.length}`);

    r = await req('POST', '/nomina/jornada-nocturna-legal', { hora_inicio_nocturno: '18:00', vigente_desde: '2025-07-15' });
    check('POST con vigente_desde duplicada → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/nomina/jornada-nocturna-legal', { hora_inicio_nocturno: '18:00', vigente_desde: '2099-01-01' });
    idJornadaNueva = r.j?.data?.id;
    check('POST nueva vigencia futura (201)', r.status === 201 && !!idJornadaNueva, `status=${r.status}`);

    log('\n===== Setup: empleado POR_HORAS, tarifa 10.000/h =====');
    r = await req('POST', '/nomina/empleados', { nombre: `ZZ_TEST_JNL_${RUN}`, apellido: 'PRUEBA', cc: `ZZTESTJNL${RUN}`, labor: 'PRUEBA' });
    idEmpleado = r.j?.data?.id;
    check('crea empleado (201)', r.status === 201 && !!idEmpleado, `status=${r.status}`);

    r = await req('POST', `/nomina/empleados/${idEmpleado}/salario`, { tipo_pago: 'POR_HORAS', tarifa_monto: 10000 });
    check('crea vigencia salarial POR_HORAS 10.000 (201)', r.status === 201, `status=${r.status}`);

    r = await req('GET', '/nomina/turnos/tipos');
    const tipos = r.j?.data || [];
    const t1 = tipos.find(t => t.nombre === 'TURNO 1');
    const t2 = tipos.find(t => t.nombre === 'TURNO 2');
    const t3 = tipos.find(t => t.nombre === 'TURNO 3');
    check('catálogo de tipos de turno tiene TURNO 1/2/3', !!t1 && !!t2 && !!t3, JSON.stringify({ t1: t1?.id, t2: t2?.id, t3: t3?.id }));

    log('\n===== 3 turnos (mañana/tarde/noche), 8h cada uno, misma quincena =====');
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const quincena = hoy.getDate() <= 15 ? 1 : 2;
    const pad = (n) => String(n).padStart(2, '0');
    const diaBase = quincena === 1 ? 1 : 16;
    const fecha1 = `${anio}-${pad(mes)}-${pad(diaBase)}`;
    const fecha2 = `${anio}-${pad(mes)}-${pad(diaBase + 1)}`;
    const fecha3 = `${anio}-${pad(mes)}-${pad(diaBase + 2)}`;

    r = await req('PUT', '/nomina/turnos/upsert', { id_empleado: idEmpleado, fecha: fecha1, id_tipo_turno: t1.id, horas_trabajadas: 8 });
    check('turno TURNO 1 (06-14) creado', r.status === 200, `status=${r.status}`);
    turnosCreados.push(fecha1);

    r = await req('PUT', '/nomina/turnos/upsert', { id_empleado: idEmpleado, fecha: fecha2, id_tipo_turno: t2.id, horas_trabajadas: 8 });
    check('turno TURNO 2 (14-22) creado', r.status === 200, `status=${r.status}`);
    turnosCreados.push(fecha2);

    r = await req('PUT', '/nomina/turnos/upsert', { id_empleado: idEmpleado, fecha: fecha3, id_tipo_turno: t3.id, horas_trabajadas: 8 });
    check('turno TURNO 3 (22-06) creado', r.status === 200, `status=${r.status}`);
    turnosCreados.push(fecha3);

    log('\n===== Preview: bruto partido por el corte legal (hoy = 19:00) =====');
    // TURNO 1 (06-14): 0% propio, 0h nocturnas → 8×10000×1.00 = 80.000
    // TURNO 2 (14-22): 25% propio, corte 19:00 → 5h día (×1.25) + 3h noche (×1.60) = 62.500+48.000 = 110.500
    // TURNO 3 (22-06): 0% propio (ya no 35%, se evita doble conteo), 8h noche (×1.35) = 108.000
    const brutoEsperado = 80000 + 110500 + 108000; // 298.500
    r = await req('GET', `/nomina/empleados/liquidaciones/preview?id_empleado=${idEmpleado}&anio=${anio}&mes=${mes}&quincena=${quincena}`);
    const preview = r.j?.data;
    check(`preview: bruto = ${brutoEsperado} (mañana+tarde con 3h nocturnas+noche completa)`,
        r.status === 200 && Number(preview?.monto_bruto) === brutoEsperado,
        `bruto=${preview?.monto_bruto} esperado=${brutoEsperado}`);
    check('preview: unidades = 24h (3×8h, sin importar la partición día/noche)', Number(preview?.unidades) === 24, `unidades=${preview?.unidades}`);

    const det1 = (preview?.detalle_turnos || []).find(d => d.fecha === fecha1);
    const det2 = (preview?.detalle_turnos || []).find(d => d.fecha === fecha2);
    const det3 = (preview?.detalle_turnos || []).find(d => d.fecha === fecha3);
    check('detalle_turnos TURNO 1: 8h día, 0h noche, 0%/0%, monto=80.000',
        det1?.horas_diurnas === 8 && det1?.horas_nocturnas === 0 && det1?.recargo_pct_diurno === 0 && det1?.recargo_pct_nocturno === 0 && Number(det1?.monto) === 80000,
        JSON.stringify(det1));
    check('detalle_turnos TURNO 2: 5h día (25%), 3h noche (60%), monto=110.500',
        det2?.horas_diurnas === 5 && det2?.horas_nocturnas === 3 && det2?.recargo_pct_diurno === 25 && det2?.recargo_pct_nocturno === 60 && Number(det2?.monto) === 110500,
        JSON.stringify(det2));
    check('detalle_turnos TURNO 3: 0h día, 8h noche (35%), monto=108.000',
        det3?.horas_diurnas === 0 && det3?.horas_nocturnas === 8 && det3?.recargo_pct_nocturno === 35 && Number(det3?.monto) === 108000,
        JSON.stringify(det3));

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
