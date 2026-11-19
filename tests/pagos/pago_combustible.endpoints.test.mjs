/**
 * Test de endpoints de COMBUSTIBLE (registro manual + forma_pago + reportes) y
 * PAGO DE COMBUSTIBLE a la gasolinera (CxP por gasolinera+mes, cascada de abonos).
 *
 *  - POST/PUT/DELETE /pagos/combustible          (registro manual, validaciones, guard de filas automáticas)
 *  - GET  /pagos/combustible?forma_pago=          (filtro nuevo)
 *  - GET  /pagos/combustible/resumen-mensual      (agregado por mes)
 *  - GET  /pagos/combustible/kpis                 (dashboard)
 *  - GET  /pagos/combustible/pagos/deuda
 *  - GET  /pagos/combustible/pagos/gasolinera/:id (materializa cuentas mensuales)
 *  - POST /pagos/combustible/pagos/gasolinera/:id/abonos (cascada más viejo → nuevo)
 *  - PATCH/DELETE /pagos/combustible/pagos/abonos/:id
 *  - GET  /pagos/combustible/pagos/abonos (paginado)
 *
 * Requisitos: server en :3005 + migracion_combustible_forma_pago_2026-09-16.sql aplicada.
 * Uso:  node tests/pagos/pago_combustible.endpoints.test.mjs
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
let idGasolinera, idGasolineraVacia, idVehiculo, idEntradaAcpm;
let combManuales = [];   // ids de Combustible manuales (para limpiar)
let combCredito = [];    // ids de Combustible a crédito (materializados en CxP)

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        const todos = [...combManuales, ...combCredito, idEntradaAcpm ? null : null].filter(Boolean);
        if (todos.length) {
            const inC = todos.map(() => '?').join(',');
            const [rel] = await db.query(`SELECT DISTINCT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_combustible IN (${inC})`, todos);
            const cuentas = rel.map(r => r.id_cuenta_pagar);
            if (cuentas.length) {
                const inCu = cuentas.map(() => '?').join(',');
                await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
            }
            await db.query(`DELETE FROM combustible WHERE id IN (${inC})`, todos);
        }
        if (idEntradaAcpm) {
            await db.query('DELETE FROM combustible WHERE id_material_planta_entrada = ?', [idEntradaAcpm]);
            await db.query('DELETE FROM material_planta_entrada WHERE id = ?', [idEntradaAcpm]);
        }
        if (idGasolinera) await db.query('DELETE FROM Saldo_A_Favor WHERE id_proveedor = ?', [idGasolinera]);
        if (idGasolinera) await db.query('DELETE FROM Proveedores WHERE id = ?', [idGasolinera]);
        if (idGasolineraVacia) await db.query('DELETE FROM Proveedores WHERE id = ?', [idGasolineraVacia]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    // ---------- Setup aislado: gasolinera de prueba ----------
    log('\n===== SETUP (gasolinera de prueba) =====');
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_GASOLINERA_${RUN}`, alias: 'zzgas', estado: 'activo' });
    idGasolinera = r.j?.data?.id ?? r.j?.id;
    check('crea gasolinera de prueba', r.status === 201 && !!idGasolinera, `id=${idGasolinera}`);
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_GASOLINERA_VACIA_${RUN}`, alias: 'zzgas2', estado: 'activo' });
    idGasolineraVacia = r.j?.data?.id ?? r.j?.id;
    check('crea 2da gasolinera (sin consumos) de prueba', r.status === 201 && !!idGasolineraVacia, `id=${idGasolineraVacia}`);

    // ---------- Validaciones de POST /combustible ----------
    log('\n===== VALIDACIONES DE REGISTRO MANUAL =====');
    r = await req('POST', '/pagos/combustible', { tipo_consumo: 'planta', forma_pago: 'credito', fecha: '2026-07-01', valor: 100000 });
    check('POST sin id_gasolinera + forma_pago=credito → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/combustible', { tipo_consumo: 'vehiculo', forma_pago: 'efectivo', fecha: '2026-07-01', valor: 100000 });
    check('POST tipo_consumo=vehiculo sin id_vehiculo/id_dueno_volqueta → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/combustible', { tipo_consumo: 'rara', fecha: '2026-07-01', valor: 100000 });
    check('POST tipo_consumo inválido → 400', r.status === 400);

    r = await req('POST', '/pagos/combustible', { forma_pago: 'bitcoin', fecha: '2026-07-01', valor: 100000, id_gasolinera: idGasolinera });
    check('POST forma_pago inválida → 400', r.status === 400);

    // ---------- Registro manual OK (2 consumos a crédito, meses distintos) ----------
    log('\n===== REGISTRO MANUAL (otro/credito) =====');
    r = await req('POST', '/pagos/combustible', { tipo_consumo: 'otro', forma_pago: 'credito', id_gasolinera: idGasolinera, fecha: '2026-07-10', descripcion: 'Consumo julio', valor: 300000, comprobante_url: 'https://x/1.png' });
    const idC1 = r.j?.data?.id;
    combManuales.push(idC1); combCredito.push(idC1);
    check('POST /combustible (julio, credito) → 201', r.status === 201 && !!idC1 && r.j?.data?.forma_pago === 'credito', `id=${idC1}`);

    r = await req('POST', '/pagos/combustible', { tipo_consumo: 'otro', forma_pago: 'credito', id_gasolinera: idGasolinera, fecha: '2026-08-15', descripcion: 'Consumo agosto', valor: 500000, comprobante_url: 'https://x/2.png' });
    const idC2 = r.j?.data?.id;
    combManuales.push(idC2); combCredito.push(idC2);
    check('POST /combustible (agosto, credito) → 201', r.status === 201 && !!idC2, `id=${idC2}`);

    r = await req('POST', '/pagos/combustible', { tipo_consumo: 'otro', forma_pago: 'efectivo', id_gasolinera: idGasolinera, fecha: '2026-07-11', descripcion: 'Caja menor', valor: 50000, comprobante_url: 'https://x/3.png' });
    const idC3 = r.j?.data?.id;
    combManuales.push(idC3);
    check('POST /combustible (efectivo) → 201', r.status === 201 && !!idC3, `id=${idC3}`);

    r = await req('GET', `/pagos/combustible?id_gasolinera=${idGasolinera}&forma_pago=credito`);
    const listaCredito = r.j?.data || [];
    check('GET /combustible?forma_pago=credito filtra correctamente', listaCredito.some(x => x.id === idC1) && listaCredito.some(x => x.id === idC2) && !listaCredito.some(x => x.id === idC3), `n=${listaCredito.length}`);

    r = await req('PUT', `/pagos/combustible/${idC1}`, { valor: 320000 });
    check('PUT /combustible/:id edita el valor', r.status === 200 && money(r.j?.data?.valor) === 320000, `valor=${r.j?.data?.valor}`);

    // ---------- Guard: no se puede editar/eliminar un ACPM automático ----------
    log('\n===== GUARD: ACPM AUTOMÁTICO NO EDITABLE AQUÍ =====');
    const [veh] = await db.execute('SELECT id FROM volqueta_vehiculo WHERE activo=1 ORDER BY id LIMIT 1');
    idVehiculo = veh[0]?.id;
    r = await req('POST', '/material/entrada', { numero_volqueta: 9101, id_mina: 1, id_vehiculo: idVehiculo, id_tipo_material: 1, fecha_llegada: '2026-09-16', peso_llegada_planta: 5, acpm: 80000 });
    idEntradaAcpm = r.j?.data?.id ?? r.j?.id;
    check('crea entrada con ACPM (fila automática de Combustible)', r.status === 201 && !!idEntradaAcpm, `id=${idEntradaAcpm}`);
    const [combAuto] = await db.execute('SELECT id, forma_pago FROM combustible WHERE id_material_planta_entrada = ?', [idEntradaAcpm]);
    check('la fila automática queda forma_pago=efectivo', combAuto.length === 1 && combAuto[0].forma_pago === 'efectivo', `forma_pago=${combAuto[0]?.forma_pago}`);
    const idCombAuto = combAuto[0]?.id;

    r = await req('PUT', `/pagos/combustible/${idCombAuto}`, { valor: 999 });
    check('PUT sobre fila automática → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);
    r = await req('DELETE', `/pagos/combustible/${idCombAuto}`);
    check('DELETE sobre fila automática → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('DELETE', `/material/entradas/${idEntradaAcpm}`);
    check('limpieza: borrar la entrada borra su Combustible', r.status === 200 && (await db.execute('SELECT id FROM combustible WHERE id_material_planta_entrada = ?', [idEntradaAcpm]))[0].length === 0);
    idEntradaAcpm = null;

    // ---------- Eliminar un registro manual ----------
    r = await req('DELETE', `/pagos/combustible/${idC3}`);
    check('DELETE /combustible/:id (manual, efectivo) → 200', r.status === 200, `status=${r.status}`);
    combManuales = combManuales.filter(id => id !== idC3);

    // ---------- Reportes: resumen-mensual y kpis ----------
    log('\n===== REPORTES =====');
    r = await req('GET', '/pagos/combustible/resumen-mensual?anio=2026');
    const meses = r.j?.data || [];
    check('GET /resumen-mensual devuelve arreglo', r.status === 200 && Array.isArray(meses));
    const julio = meses.find(m => m.periodo === '2026-07');
    check('julio incluye el consumo a crédito (320000) dentro de total_credito', julio && money(julio.total_credito) >= 320000, `total_credito=${julio?.total_credito}`);

    r = await req('GET', '/pagos/combustible/kpis');
    const k = r.j?.data;
    check('GET /kpis trae mes_actual/mes_anterior/top_gasolineras/top_duenos_adelanto', r.status === 200 &&
        k && 'mes_actual' in k && 'mes_anterior' in k && Array.isArray(k.top_gasolineras) && Array.isArray(k.top_duenos_adelanto) && Array.isArray(k.meses),
        `keys=${Object.keys(k || {})}`);

    // ---------- Pago a la gasolinera: dashboard y materialización ----------
    log('\n===== PAGO A GASOLINERA: DASHBOARD Y ESTADO DE CUENTA =====');
    r = await req('GET', '/pagos/combustible/pagos/deuda');
    let dRow = (r.j?.data || []).find(x => Number(x.id) === Number(idGasolinera));
    check('deuda incluye a la gasolinera con saldo = 320000+500000', dRow && near(dRow.saldo_pendiente, 820000), `saldo=${dRow?.saldo_pendiente}`);
    check('gasolinera vacía no aparece en /deuda (sin credito)', !(r.j?.data || []).some(x => Number(x.id) === Number(idGasolineraVacia)));

    r = await req('GET', `/pagos/combustible/pagos/gasolinera/${idGasolinera}`);
    const ec = r.j?.data;
    check('estado de cuenta materializa 2 meses (julio, agosto)', ec?.meses?.length === 2, `meses=${ec?.meses?.length}`);
    const mesJul = ec.meses.find(m => m.periodo === '2026-07');
    const mesAgo = ec.meses.find(m => m.periodo === '2026-08');
    check('mes julio: valor_total=320000, 1 consumo', mesJul && near(mesJul.valor_total, 320000) && mesJul.num_consumos === 1, `vt=${mesJul?.valor_total}`);
    check('mes agosto: valor_total=500000', mesAgo && near(mesAgo.valor_total, 500000), `vt=${mesAgo?.valor_total}`);
    check('resumen.total_credito = 820000', near(ec.resumen.total_credito, 820000), `tc=${ec.resumen.total_credito}`);

    r = await req('GET', `/pagos/combustible/pagos/gasolinera/${idGasolineraVacia}/`.replace(/\/$/, ''));
    check('gasolinera sin consumos: estado de cuenta con 0 meses', (r.j?.data?.meses || []).length === 0, `meses=${r.j?.data?.meses?.length}`);
    r = await req('POST', `/pagos/combustible/pagos/gasolinera/${idGasolineraVacia}/abonos`, { valor: 1000, comprobante_url: 'https://x/n.png' });
    check('abonar a gasolinera sin deuda → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Abono en cascada (paga julio primero, luego parte de agosto) ----------
    log('\n===== ABONO EN CASCADA =====');
    r = await req('POST', `/pagos/combustible/pagos/gasolinera/${idGasolinera}/abonos`, { valor: 320000, fecha_abono: '2026-09-01', metodo_pago: 'transferencia', comprobante_url: 'https://x/a1.png' });
    check('abono cubre exactamente julio (mes más viejo)', r.status === 201 && r.j?.data?.aplicado_a?.length === 1 && r.j.data.aplicado_a[0].periodo === '2026-07' && r.j.data.aplicado_a[0].estado === 'pagado', `aplicado=${JSON.stringify(r.j?.data?.aplicado_a)}`);

    r = await req('GET', `/pagos/combustible/pagos/gasolinera/${idGasolinera}`);
    const agoAntes = r.j.data.meses.find(m => m.periodo === '2026-08');
    const saldoAgo = money(agoAntes.saldo);

    r = await req('POST', `/pagos/combustible/pagos/gasolinera/${idGasolinera}/abonos`, { valor: Math.round(saldoAgo + 7000), fecha_abono: '2026-09-02', metodo_pago: 'transferencia', comprobante_url: 'https://x/a2.png' });
    check('abono que salda agosto + sobrepago genera saldo a favor', r.status === 201 && near(r.j?.data?.saldo_a_favor_generado, 7000), `saf=${r.j?.data?.saldo_a_favor_generado}`);

    r = await req('GET', '/pagos/combustible/pagos/deuda');
    dRow = (r.j?.data || []).find(x => Number(x.id) === Number(idGasolinera));
    check('gasolinera ya no aparece con saldo pendiente (solo sobrepago)', !dRow || dRow.saldo_pendiente === 0, `row=${JSON.stringify(dRow)}`);
    r = await req('GET', '/pagos/vistas/saldos-a-favor');
    check('saldo a favor de la gasolinera visible en /vistas/saldos-a-favor', (r.j?.data || []).some(s => s.tipo_beneficiario === 'proveedor' && s.beneficiario === `ZZ_TEST_GASOLINERA_${RUN}`), `n=${r.j?.data?.length}`);

    // ---------- Editar / eliminar abono ----------
    log('\n===== EDITAR / ELIMINAR ABONO =====');
    r = await req('GET', `/pagos/combustible/pagos/gasolinera/${idGasolinera}?mes=7&anio=2026`);
    const abJul = r.j.data.meses[0].abonos;
    const primer = abJul[0];
    r = await req('PATCH', `/pagos/combustible/pagos/abonos/${primer.id}`, { valor: Math.round(Number(primer.valor) - 50000) });
    check('PATCH abono de combustible recalcula la cuenta (200)', r.status === 200 && r.j?.data?.cuenta?.estado === 'parcial', `estado=${r.j?.data?.cuenta?.estado}`);

    r = await req('GET', `/pagos/combustible/pagos/abonos?id_gasolinera=${idGasolinera}&limit=10`);
    check('GET /combustible/pagos/abonos (paginado) incluye el abono editado', r.status === 200 && (r.j?.data?.abonos || []).some(a => Number(a.id) === Number(primer.id)), `n=${r.j?.data?.abonos?.length}`);

    r = await req('DELETE', `/pagos/combustible/pagos/abonos/${primer.id}`);
    check('DELETE abono de combustible → 200', r.status === 200, `status=${r.status}`);

    // ---------- Guard: consumo ya materializado en CxP (con y sin abonos) ----------
    // Nota: el abono de julio (idC1) se eliminó arriba → su CxP vuelve a 'pendiente' con abonado=0,
    // pero SIGUE materializada (la Relacion no se borra al borrar el abono) → debe seguir bloqueada.
    // El abono de agosto (idC2) no se tocó → su CxP sigue 'pagado'.
    log('\n===== GUARD: CONSUMO YA MATERIALIZADO EN CxP =====');
    r = await req('GET', `/pagos/combustible/${idC1}`);
    check('GET /combustible/:id (julio, sin abonos tras el DELETE) expone estado_pago=pendiente', r.status === 200 && r.j?.data?.estado_pago === 'pendiente' && near(r.j?.data?.saldo_pendiente, 320000), `estado=${r.j?.data?.estado_pago} saldo=${r.j?.data?.saldo_pendiente}`);
    r = await req('PUT', `/pagos/combustible/${idC1}`, { valor: 1 });
    check('PUT sobre consumo materializado sin abonos → 409 (bloqueado igual)', r.status === 409 && /agrupado en una cuenta por pagar/.test(r.j?.message || ''), `status=${r.status} msg=${r.j?.message}`);
    r = await req('DELETE', `/pagos/combustible/${idC1}`);
    check('DELETE sobre consumo materializado sin abonos → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('GET', `/pagos/combustible/${idC2}`);
    check('GET /combustible/:id (agosto, ya pagado) expone estado_pago=pagado', r.status === 200 && r.j?.data?.estado_pago === 'pagado' && near(r.j?.data?.saldo_pendiente, 0), `estado=${r.j?.data?.estado_pago} saldo=${r.j?.data?.saldo_pendiente}`);
    r = await req('DELETE', `/pagos/combustible/${idC2}`);
    check('DELETE sobre consumo materializado CON abonos → 409, mensaje distingue el caso', r.status === 409 && /ya tiene abonos aplicados/.test(r.j?.message || ''), `status=${r.status} msg=${r.j?.message}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Combustible: registro + pago a gasolinera\n\n`;
    md += `> Generado por \`tests/pagos/pago_combustible.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- POST/PUT/DELETE /pagos/combustible · GET /pagos/combustible?forma_pago=\n`;
    md += `- GET /pagos/combustible/resumen-mensual · GET /pagos/combustible/kpis\n`;
    md += `- GET /pagos/combustible/pagos/deuda · GET /pagos/combustible/pagos/gasolinera/:id\n`;
    md += `- POST /pagos/combustible/pagos/gasolinera/:id/abonos · PATCH/DELETE /pagos/combustible/pagos/abonos/:id · GET /pagos/combustible/pagos/abonos\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_PAGO_COMBUSTIBLE_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
