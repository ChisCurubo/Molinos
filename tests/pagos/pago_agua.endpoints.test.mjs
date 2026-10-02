/**
 * Test de endpoints de PAGO DE AGUA (Fase B parte 2).
 * Crea un dueño + vehículo AISLADO, registra viajes de agua con ACPM (cruzado desde Combustible),
 * y prueba deuda, estado de cuenta, cascada, estado por registro (agua_planta.estado_pago),
 * trazabilidad (bruto/acpm/neto por registro), los 2 positivos de gasolina, editar/eliminar abono
 * y el reporte-mensual con abonado real (ya no 0).
 *
 * Requisitos: server en :3005 + migracion_pagos_agua_2026-09-05.sql aplicada.
 * Uso:  node tests/pagos/pago_agua.endpoints.test.mjs
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3005/api/v1';
const USER = process.env.LOGIN_USER || 'david@molinosdecolombia.com';
const PASS = process.env.LOGIN_PASS || 'molinos2026';
const RUN = String(Date.now()).slice(-6);

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

let idDueno, idVehiculo, aguas = [];
async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (idDueno) {
            const [cu] = await db.query(
                `SELECT id FROM Cuentas_Por_Pagar WHERE id_dueno_volqueta=? AND id_categoria=(SELECT id FROM Categorias_CxP WHERE nombre='Agua' LIMIT 1)`, [idDueno]);
            const cuentas = cu.map(r => r.id);
            if (cuentas.length) {
                const inCu = cuentas.map(() => '?').join(',');
                await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
            }
        }
        if (aguas.length) {
            const inA = aguas.map(() => '?').join(',');
            await db.query(`DELETE FROM Combustible WHERE id_agua IN (${inA})`, aguas);
            await db.query(`DELETE FROM agua_planta WHERE id IN (${inA})`, aguas);
        }
        if (idDueno) await db.query('DELETE FROM Saldo_A_Favor WHERE id_dueno_volqueta = ?', [idDueno]);
        if (idVehiculo) await db.query('DELETE FROM Volqueta_Vehiculo WHERE id = ?', [idVehiculo]);
        if (idDueno) await db.query('DELETE FROM Dueno_Volqueta WHERE id = ?', [idDueno]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

async function estadoAgua(id) {
    const [r] = await db.execute('SELECT estado_pago FROM agua_planta WHERE id=?', [id]);
    return r[0]?.estado_pago;
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    // ---------- Setup aislado ----------
    log('\n===== SETUP (dueño + vehículo aislados) =====');
    r = await req('POST', '/material/volqueta/dueno', { nombre: `ZZ_TEST_AGUA_${RUN}`, titular: 'Test Agua', cc: `98${RUN}1`, banco: 'Bancolombia', numero_cuenta: '000', alias: 'zzagua', telefono: '3000000000', nequi: false });
    idDueno = r.j?.data?.id ?? r.j?.id;
    check('crea dueño de prueba', !!idDueno, `id=${idDueno}`);
    r = await req('POST', '/material/volqueta', { id_dueno_volqueta: idDueno, placa: `ZZA-${RUN}`, tipo_vehiculo: 'Cisterna', conductor: 'Test', conductor_cc: `98${RUN}2`, capacidad_ton: 20, activo: 1 });
    idVehiculo = (typeof r.j?.data === 'number') ? r.j.data : (r.j?.data?.id ?? r.j?.id);
    check('crea vehículo de prueba', !!idVehiculo, `id=${idVehiculo}`);

    // 3 registros de agua: R1 (may, acpm parcial), R2 (may, acpm 0), R3 (jun, acpm > bruto)
    const mk = async (fecha, valorViaje, cant, acpm) => {
        const rr = await req('POST', '/material/agua', { id_vehiculo: idVehiculo, fecha, valor_viaje: valorViaje, cantidad_viajes: cant, acpm });
        const id = rr.j?.data?.id ?? rr.j?.id;
        aguas.push(id);
        const d = await req('GET', `/material/agua/${id}`);
        return { id, bruto: money(d.j?.data?.valor_total), acpm: money(d.j?.data?.acpm), neto: money(d.j?.data?.valor_neto) };
    };
    const R1 = await mk('2026-05-10', 50000, 2, 30000); // bruto 100k, neto 70k
    const R2 = await mk('2026-05-20', 50000, 1, 0);     // bruto 50k, neto 50k
    const R3 = await mk('2026-06-05', 40000, 1, 100000);// bruto 40k, acpm 100k > bruto → neto 0, gasolina 60k
    check('R1 bruto 100k / acpm 30k / neto 70k', near(R1.bruto, 100000) && near(R1.acpm, 30000) && near(R1.neto, 70000), `bruto=${R1.bruto} neto=${R1.neto}`);
    check('R3 acpm(100k) > bruto(40k) → neto 0', near(R3.neto, 0), `neto=${R3.neto}`);
    const netoTotal = 70000 + 50000 + 0;          // 120k
    const gasolina = Math.max(0, 100000 - 40000);  // 60k (positivo de gasolina de R3)

    // ---------- Dashboard ----------
    log('\n===== DASHBOARD /pagos/agua/deuda =====');
    r = await req('GET', '/pagos/agua/deuda');
    const dRow = (r.j?.data || []).find(x => Number(x.id) === Number(idDueno));
    check('deuda incluye al dueño', !!dRow, `saldo=${dRow?.saldo_pendiente}`);
    check('deuda saldo = neto_total (sin abonos)', dRow && near(dRow.saldo_pendiente, netoTotal), `saldo=${dRow?.saldo_pendiente}`);
    check('deuda credito_gasolina = ACPM adelantado de más', dRow && near(dRow.credito_gasolina, gasolina), `cg=${dRow?.credito_gasolina}`);
    check('deuda credito_sobrepago = 0', dRow && near(dRow.credito_sobrepago, 0));

    // ---------- Estado de cuenta ----------
    log('\n===== ESTADO DE CUENTA /pagos/agua/dueno/:id =====');
    r = await req('GET', `/pagos/agua/dueno/${idDueno}`);
    const ec = r.j?.data;
    check('arma 1 mes (mayo; junio saldado por ACPM)', ec?.meses?.length === 1, `meses=${ec?.meses?.length}`);
    const may = ec.meses.find(m => m.periodo === '2026-05');
    check('mayo tiene 2 registros (R1, R2)', may?.num_registros === 2, `regs=${may?.num_registros}`);
    const regR1 = may?.registros?.find(x => x.id_agua === R1.id);
    check('trazabilidad R1: bruto/acpm/neto visibles', regR1 && near(regR1.bruto, 100000) && near(regR1.acpm, 30000) && near(regR1.neto, 70000), `bruto=${regR1?.bruto} neto=${regR1?.neto}`);
    check('resumen.neto_total = 120k', near(ec.resumen.neto_total, netoTotal));
    check('resumen.credito_gasolina = 60k', near(ec.resumen.credito_gasolina, gasolina));
    check('R3 (neto 0) quedó estado_pago=pagado', (await estadoAgua(R3.id)) === 'pagado', `estado=${await estadoAgua(R3.id)}`);

    // ---------- Abono en cascada ----------
    log('\n===== ABONO EN CASCADA =====');
    const saldoMay = money(may.saldo);
    r = await req('POST', `/pagos/agua/dueno/${idDueno}/abonos`, { valor: Math.round(saldoMay * 0.5), fecha_abono: '2026-06-10', comprobante_url: 'https://x/a.png' });
    check('abono parcial aplicado a mayo', r.status === 201 && r.j?.data?.aplicado_a?.[0]?.periodo === '2026-05', `aplicado=${JSON.stringify(r.j?.data?.aplicado_a?.[0]||{})}`);
    check('R1 ahora estado_pago=parcial', (await estadoAgua(R1.id)) === 'parcial', `estado=${await estadoAgua(R1.id)}`);

    r = await req('GET', `/pagos/agua/dueno/${idDueno}?mes=5&anio=2026`);
    const saldoRest = money(r.j.data.meses[0].saldo);
    r = await req('POST', `/pagos/agua/dueno/${idDueno}/abonos`, { valor: Math.round(saldoRest + 5000), fecha_abono: '2026-06-11', comprobante_url: 'https://x/b.png' });
    check('abono que salda mayo genera saldo a favor (sobrepago)', r.status === 201 && near(r.j?.data?.saldo_a_favor_generado, 5000), `saf=${r.j?.data?.saldo_a_favor_generado}`);
    check('R1 ahora estado_pago=pagado', (await estadoAgua(R1.id)) === 'pagado', `estado=${await estadoAgua(R1.id)}`);

    // ---------- reporte-mensual con abonado real ----------
    log('\n===== REPORTE-MENSUAL (abonado ya no es 0) =====');
    r = await req('GET', '/material/agua/reporte-mensual?mes=5&anio=2026');
    const du = (r.j?.data?.duenos || []).find(x => Number(x.id_dueno) === Number(idDueno));
    check('reporte-mensual: abonado > 0 (sale de Abonos_CxP)', du && Number(du.resumen.abonado) > 0, `abonado=${du?.resumen?.abonado}`);
    check('reporte-mensual: saldo_fin = neto_mes − abonado', du && near(du.resumen.saldo_fin, du.resumen.neto_mes - du.resumen.abonado), `fin=${du?.resumen?.saldo_fin}`);

    // ---------- Editar / eliminar abono ----------
    log('\n===== EDITAR / ELIMINAR ABONO =====');
    r = await req('GET', `/pagos/agua/dueno/${idDueno}?mes=5&anio=2026`);
    const primer = r.j.data.meses[0].abonos[0];
    r = await req('PATCH', `/pagos/agua/abonos/${primer.id}`, { valor: Math.round(Number(primer.valor) - 20000) });
    check('PATCH abono (200) revierte R1 a parcial', r.status === 200 && (await estadoAgua(R1.id)) === 'parcial', `status=${r.status} estado=${await estadoAgua(R1.id)}`);

    log('\n===== GET /pagos/agua/abonos (paginado) =====');
    r = await req('GET', `/pagos/agua/abonos?id_dueno_volqueta=${idDueno}&limit=5`);
    check('GET /pagos/agua/abonos (200, arreglo + paginación)', r.status === 200 && Array.isArray(r.j?.data?.abonos) && r.j?.data?.pagination?.limit === 5, `n=${r.j?.data?.abonos?.length} pag=${JSON.stringify(r.j?.data?.pagination)}`);
    check('GET /pagos/agua/abonos incluye el abono editado', (r.j?.data?.abonos || []).some(a => Number(a.id) === Number(primer.id)), `ids=${(r.j?.data?.abonos || []).map(a => a.id)}`);
    r = await req('GET', '/pagos/agua/abonos?limit=500');
    check('GET /pagos/agua/abonos limita a 50 aunque pidas 500', r.j?.data?.pagination?.limit === 50, `limit=${r.j?.data?.pagination?.limit}`);

    r = await req('DELETE', `/pagos/agua/abonos/${primer.id}`);
    check('DELETE abono (200) mantiene R1 en parcial', r.status === 200 && (await estadoAgua(R1.id)) === 'parcial', `estado=${await estadoAgua(R1.id)}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Pago de AGUA (Fase B parte 2)\n\n`;
    md += `> Generado por \`tests/pagos/pago_agua.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- GET /pagos/agua/deuda · GET /pagos/agua/dueno/:id (?mes&anio) · POST /pagos/agua/dueno/:id/abonos\n`;
    md += `- PATCH /pagos/agua/abonos/:id · DELETE /pagos/agua/abonos/:id\n`;
    md += `- Efecto por registro: agua_planta.estado_pago · reporte-mensual con abonado real\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_AGUA_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
