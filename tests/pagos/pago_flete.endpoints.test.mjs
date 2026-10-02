/**
 * Test de endpoints de PAGO DE FLETE (Fase B).
 * Crea un dueño + vehículo AISLADO, registra fletes con ACPM, y prueba:
 *  - GET  /pagos/flete/deuda
 *  - GET  /pagos/flete/dueno/:id            (materializa cuentas mensuales)
 *  - POST /pagos/flete/dueno/:id/abonos     (cascada más viejo → nuevo)
 *  - PATCH/DELETE /pagos/flete/abonos/:id
 *  - estado por viaje (material_planta_entrada.estado_pago_flete) + Volqueta_Vehiculo.estado_pago
 *  - trazabilidad (flete_bruto / acpm / flete_neto por viaje) y los 2 "positivos de gasolina".
 *
 * Requisitos: server en :3005 + migracion_pagos_flete_2026-09-05.sql aplicada.
 * Uso:  node tests/pagos/pago_flete.endpoints.test.mjs
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

const RUN = String(Date.now()).slice(-6);   // sufijo único por corrida (evita choques de placa/cc)
let idDueno, idVehiculo, entradas = [];
async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (entradas.length) {
            const inC = entradas.map(() => '?').join(',');
            const [rel] = await db.query(`SELECT DISTINCT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_entrada IN (${inC})`, entradas);
            const cuentas = rel.map(r => r.id_cuenta_pagar);
            if (cuentas.length) {
                const inCu = cuentas.map(() => '?').join(',');
                await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
            }
            await db.query(`DELETE FROM Combustible WHERE id_material_planta_entrada IN (${inC})`, entradas);
            await db.query(`DELETE FROM material_planta_entrada WHERE id IN (${inC})`, entradas);
        }
        if (idDueno) await db.query('DELETE FROM Saldo_A_Favor WHERE id_dueno_volqueta = ?', [idDueno]);
        if (idVehiculo) await db.query('DELETE FROM Volqueta_Vehiculo WHERE id = ?', [idVehiculo]);
        if (idDueno) await db.query('DELETE FROM Dueno_Volqueta WHERE id = ?', [idDueno]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

async function estadoFlete(idEntrada) {
    const [r] = await db.execute('SELECT estado_pago_flete FROM material_planta_entrada WHERE id=?', [idEntrada]);
    return r[0]?.estado_pago_flete;
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    // ---------- Setup aislado: dueño + vehículo ----------
    log('\n===== SETUP (dueño + vehículo aislados) =====');
    r = await req('POST', '/material/volqueta/dueno', { nombre: `ZZ_TEST_FLETE_${RUN}`, titular: 'Test Flete', cc: `99${RUN}1`, banco: 'Bancolombia', numero_cuenta: '000', alias: 'zztest', telefono: '3000000000', nequi: false });
    idDueno = r.j?.data?.id ?? r.j?.id;
    check('crea dueño de prueba', !!idDueno, `id=${idDueno}`);
    r = await req('POST', '/material/volqueta', { id_dueno_volqueta: idDueno, placa: `ZZT-${RUN}`, tipo_vehiculo: 'Doble troque', conductor: 'Test', conductor_cc: `99${RUN}2`, capacidad_ton: 30, activo: 1 });
    idVehiculo = (typeof r.j?.data === 'number') ? r.j.data : (r.j?.data?.id ?? r.j?.id);
    check('crea vehículo de prueba', !!idVehiculo, `id=${idVehiculo}`);

    // 3 fletes: A (may, acpm 0), B (may, acpm parcial), C (jun, acpm > flete → positivo gasolina)
    const mk = async (fecha, peso, acpm, num) => {
        const rr = await req('POST', '/material/entrada', { numero_volqueta: num, id_mina: 1, id_vehiculo: idVehiculo, id_tipo_material: 1, fecha_llegada: fecha, peso_llegada_planta: peso, acpm });
        const id = rr.j?.data?.id ?? rr.j?.id;
        entradas.push(id);
        // El costo_volqueta (flete = peso × tarifa de zona) se congela en el PUT, no en el POST.
        await req('PUT', `/material/entradas/${id}`, { id_mina: 1, id_vehiculo: idVehiculo, peso_llegada_planta: peso, acpm });
        const d = await req('GET', `/material/entradas/${id}`);
        return { id, flete: money(d.j?.data?.detalle?.flete), acpm: money(d.j?.data?.detalle?.acpm_adelantado), neto: money(d.j?.data?.detalle?.flete_neto) };
    };
    const A = await mk('2026-05-10', 10, 0, 8801);
    const B = await mk('2026-05-20', 10, Math.round(A.flete * 0.5), 8802);
    const C = await mk('2026-06-05', 1, A.flete * 5 + 1_000_000, 8803); // ACPM enorme > flete de C
    check('setup: 3 fletes creados con flete>0', A.flete > 0 && B.flete > 0 && C.flete > 0, `A=${A.flete} B=${B.flete} C=${C.flete}`);
    check('B: flete_neto = flete - acpm', near(B.neto, B.flete - B.acpm), `neto=${B.neto}`);
    check('C: flete_neto = 0 (ACPM > flete)', near(C.neto, 0), `neto=${C.neto}`);

    // ---------- Consistencia con el endpoint de combustible (fuente del neto) ----------
    log('\n===== NETO / POSITIVO DE GASOLINA (combustible) =====');
    r = await req('GET', `/pagos/combustible/dueno/${idDueno}/neto-flete`);
    const cNeto = r.j?.data;
    const arrastreEsperado = Math.max(0, C.acpm - C.flete); // lo que sobró del ACPM de C
    check('combustible: total_flete_neto = A + (B-acpmB) + 0', near(cNeto.total_flete_neto, A.flete + (B.flete - B.acpm)), `neto=${cNeto.total_flete_neto}`);
    check('combustible: acpm_arrastre_pendiente = positivo de gasolina', near(cNeto.acpm_arrastre_pendiente, arrastreEsperado), `arrastre=${cNeto.acpm_arrastre_pendiente}`);

    // ---------- Dashboard de deuda ----------
    log('\n===== DASHBOARD /pagos/flete/deuda =====');
    r = await req('GET', '/pagos/flete/deuda');
    const dRow = (r.j?.data || []).find(x => Number(x.id) === Number(idDueno));
    check('deuda incluye al dueño', !!dRow, `saldo=${dRow?.saldo_pendiente}`);
    check('deuda saldo = flete_neto_total (sin abonos aún)', dRow && near(dRow.saldo_pendiente, cNeto.total_flete_neto), `saldo=${dRow?.saldo_pendiente} neto=${cNeto.total_flete_neto}`);
    check('deuda credito_gasolina = arrastre ACPM', dRow && near(dRow.credito_gasolina, arrastreEsperado), `cg=${dRow?.credito_gasolina}`);
    check('deuda credito_sobrepago = 0 (sin abonos)', dRow && near(dRow.credito_sobrepago, 0));

    // ---------- Estado de cuenta (materializa cuentas mensuales) ----------
    log('\n===== ESTADO DE CUENTA /pagos/flete/dueno/:id =====');
    r = await req('GET', `/pagos/flete/dueno/${idDueno}`);
    const ec = r.j?.data;
    // Junio (viaje C) se salda 100% con ACPM → no genera CxP; solo queda mayo (A, B).
    check('estado cuenta arma 1 mes (mayo; junio saldado por ACPM)', ec?.meses?.length === 1, `meses=${ec?.meses?.length}`);
    const may = ec.meses.find(m => m.periodo === '2026-05');
    check('mes mayo tiene 2 viajes (A, B)', may?.num_viajes === 2, `viajes=${may?.num_viajes}`);
    const viajeA = may?.viajes?.find(v => v.id_entrada === A.id);
    check('trazabilidad viaje A: flete_bruto/acpm/flete_neto visibles', viajeA && near(viajeA.flete_bruto, A.flete) && near(viajeA.acpm, 0) && near(viajeA.flete_neto, A.flete), `bruto=${viajeA?.flete_bruto} neto=${viajeA?.flete_neto}`);
    check('resumen.flete_neto_total = combustible neto', near(ec.resumen.flete_neto_total, cNeto.total_flete_neto));
    check('resumen.credito_gasolina = arrastre', near(ec.resumen.credito_gasolina, arrastreEsperado));
    // C con neto 0 quedó marcado pagado (saldado por ACPM)
    check('viaje C (neto 0) quedó estado_pago_flete=pagado', (await estadoFlete(C.id)) === 'pagado', `estado=${await estadoFlete(C.id)}`);

    // ---------- Abono en cascada (parcial: cubre mayo y parte de junio... aquí junio neto=0) ----------
    log('\n===== ABONO EN CASCADA =====');
    const saldoMay = money(may.saldo);
    const abono1 = Math.round(saldoMay * 0.5); // paga la mitad de mayo
    r = await req('POST', `/pagos/flete/dueno/${idDueno}/abonos`, { valor: abono1, fecha_abono: '2026-06-10', comprobante_url: 'https://x/y.png' });
    check('abono parcial aplicado a mayo', r.status === 201 && r.j?.data?.aplicado_a?.[0]?.periodo === '2026-05', `aplicado=${JSON.stringify(r.j?.data?.aplicado_a?.[0]||{})}`);
    check('mayo queda parcial', (await req('GET', `/pagos/flete/dueno/${idDueno}?mes=5&anio=2026`)).j?.data?.meses?.[0]?.estado === 'parcial');
    check('viaje A ahora estado_pago_flete=parcial', (await estadoFlete(A.id)) === 'parcial', `estado=${await estadoFlete(A.id)}`);
    let [vv] = await db.execute('SELECT estado_pago FROM Volqueta_Vehiculo WHERE id=?', [idVehiculo]);
    check('Volqueta_Vehiculo.estado_pago = parcial', vv[0].estado_pago === 'parcial', `estado=${vv[0].estado_pago}`);

    // Completa mayo + sobrepago → saldo a favor del dueño
    r = await req('GET', `/pagos/flete/dueno/${idDueno}?mes=5&anio=2026`);
    const saldoMayRest = money(r.j.data.meses[0].saldo);
    r = await req('POST', `/pagos/flete/dueno/${idDueno}/abonos`, { valor: Math.round(saldoMayRest + 5000), fecha_abono: '2026-06-11', comprobante_url: 'https://x/z.png' });
    check('abono que salda mayo genera saldo a favor (sobrepago)', r.status === 201 && near(r.j?.data?.saldo_a_favor_generado, 5000), `saf=${r.j?.data?.saldo_a_favor_generado}`);
    check('viaje A ahora estado_pago_flete=pagado', (await estadoFlete(A.id)) === 'pagado', `estado=${await estadoFlete(A.id)}`);
    r = await req('GET', '/pagos/flete/deuda');
    const dRow2 = (r.j?.data || []).find(x => Number(x.id) === Number(idDueno));
    check('dashboard credito_sobrepago refleja el sobrepago', dRow2 && near(dRow2.credito_sobrepago, 5000), `cs=${dRow2?.credito_sobrepago}`);

    // ---------- Editar / eliminar abono ----------
    log('\n===== EDITAR / ELIMINAR ABONO =====');
    // Tomamos el primer abono de mayo
    r = await req('GET', `/pagos/flete/dueno/${idDueno}?mes=5&anio=2026`);
    const abMay = r.j.data.meses[0].abonos;
    const primer = abMay[0];
    // Reducir el abono baja el pagado de la cuenta → mayo vuelve a 'parcial' y el viaje A también.
    r = await req('PATCH', `/pagos/flete/abonos/${primer.id}`, { valor: Math.round(Number(primer.valor) - 100000) });
    check('PATCH abono recalcula (200) y revierte A a parcial', r.status === 200 && (await estadoFlete(A.id)) === 'parcial', `status=${r.status} estado=${await estadoFlete(A.id)}`);

    log('\n===== GET /pagos/flete/abonos (paginado) =====');
    r = await req('GET', `/pagos/flete/abonos?id_dueno_volqueta=${idDueno}&limit=5`);
    check('GET /pagos/flete/abonos (200, arreglo + paginación)', r.status === 200 && Array.isArray(r.j?.data?.abonos) && r.j?.data?.pagination?.limit === 5, `n=${r.j?.data?.abonos?.length} pag=${JSON.stringify(r.j?.data?.pagination)}`);
    check('GET /pagos/flete/abonos incluye el abono editado', (r.j?.data?.abonos || []).some(a => Number(a.id) === Number(primer.id)), `ids=${(r.j?.data?.abonos || []).map(a => a.id)}`);
    r = await req('GET', '/pagos/flete/abonos?limit=500');
    check('GET /pagos/flete/abonos limita a 50 aunque pidas 500', r.j?.data?.pagination?.limit === 50, `limit=${r.j?.data?.pagination?.limit}`);

    r = await req('DELETE', `/pagos/flete/abonos/${primer.id}`);
    check('DELETE abono (200) mantiene A en parcial', r.status === 200 && (await estadoFlete(A.id)) === 'parcial', `estado=${await estadoFlete(A.id)}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Pago de FLETE (Fase B)\n\n`;
    md += `> Generado por \`tests/pagos/pago_flete.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- GET /pagos/flete/deuda · GET /pagos/flete/dueno/:id (?mes&anio) · POST /pagos/flete/dueno/:id/abonos\n`;
    md += `- PATCH /pagos/flete/abonos/:id · DELETE /pagos/flete/abonos/:id\n`;
    md += `- Efecto por viaje: material_planta_entrada.estado_pago_flete + Volqueta_Vehiculo.estado_pago\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_FLETE_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
