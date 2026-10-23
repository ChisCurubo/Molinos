/**
 * Test de endpoints de PRESTAMOS FINANCIEROS (préstamo bancario/fondo de la empresa,
 * distinto de Prestamos_Empleados). CRUD completo (DELETE/PATCH nuevos 2026-09-19) con
 * el guard de borrado: solo se elimina si nunca tuvo actividad (saldo_pendiente == monto_principal).
 *
 *  - POST/GET/PUT/PATCH/DELETE /pagos/prestamos-financieros
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/pagos/prestamo_financiero.endpoints.test.mjs
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

const near = (a, b, eps = 1) => Math.abs(Number(a) - Number(b)) <= eps;
const RUN = String(Date.now()).slice(-6);
let idIntacto, idConActividad, idDeudaReal;
async function cleanup() {
    try {
        // Fase 2 (Tesorería): todo préstamo creado por API genera un Ingresos_Tesoreria espejo
        // Y (2026-10-23) una CxP persistente (Cuentas_Por_Pagar + su fila en
        // Cuentas_Por_Pagar_Relacion) — hay que borrar ambos antes que al préstamo por la FK.
        for (const id of [idIntacto, idConActividad, idDeudaReal]) {
            if (id) {
                await db.query('DELETE FROM Ingresos_Tesoreria WHERE id_prestamo_fin = ?', [id]);
                // Movimientos_Prestamo_Financiero.id_abono_cxp referencia Abonos_CxP sin cascada —
                // hay que borrarlo antes de borrar la CxP (que cascada-borra sus Abonos_CxP).
                await db.query('DELETE FROM Movimientos_Prestamo_Financiero WHERE id_prestamo_fin = ?', [id]);
                await db.query(
                    `DELETE FROM Cuentas_Por_Pagar WHERE id = (SELECT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_prestamo_fin = ? LIMIT 1)`,
                    [id]
                );
            }
        }
        if (idIntacto) await db.query('DELETE FROM prestamos_financieros WHERE id = ?', [idIntacto]);
        if (idConActividad) await db.query('DELETE FROM prestamos_financieros WHERE id = ?', [idConActividad]);
        if (idDeudaReal) await db.query('DELETE FROM prestamos_financieros WHERE id = ?', [idDeudaReal]);
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== CRUD Prestamo Financiero =====');
    r = await req('POST', '/pagos/prestamos-financieros', {
        nombre_prestamo: `ZZ_TEST_PRESTAMO_${RUN}`, fecha_adquisicion: '2026-09-19',
        monto_principal: 10000000, tasa_interes: 2, saldo_pendiente: 10000000
    });
    idIntacto = r.j?.data?.id;
    check('crea préstamo (201)', r.status === 201 && !!idIntacto, `status=${r.status} id=${idIntacto}`);

    r = await req('GET', `/pagos/prestamos-financieros/${idIntacto}`);
    check('detalle (200)', r.status === 200 && r.j?.data?.id === idIntacto, `data=${JSON.stringify(r.j?.data || {})}`);

    r = await req('PATCH', `/pagos/prestamos-financieros/${idIntacto}`, { tasa_interes: 2.5 });
    check('PATCH actualiza parcial (nuevo)', r.status === 200 && Number(r.j?.data?.tasa_interes) === 2.5, `tasa=${r.j?.data?.tasa_interes}`);

    r = await req('GET', '/pagos/prestamos-financieros');
    check('listado incluye el creado', r.status === 200 && (r.j?.data || []).some(p => p.id === idIntacto), `n=${r.j?.data?.length}`);

    log('\n===== CxP persistente: deuda real visible en /cxp/mensual (2026-10-23) =====');
    r = await req('POST', '/pagos/prestamos-financieros', {
        nombre_prestamo: `ZZ_TEST_DEUDA_REAL_${RUN}`, fecha_adquisicion: '2026-09-19',
        monto_principal: 4000000, tasa_interes: 2
    });
    idDeudaReal = r.j?.data?.id;
    check('setup: 3er préstamo creado', r.status === 201 && !!idDeudaReal, `id=${idDeudaReal}`);

    const [[relRow]] = await db.query('SELECT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_prestamo_fin = ?', [idDeudaReal]);
    const idCxp = relRow?.id_cuenta_pagar;
    check('al crear, se abre exactamente 1 CxP persistente', !!idCxp, `idCxp=${idCxp}`);

    const [[cxpInicial]] = await db.query('SELECT estado, valor_total, valor_pagado FROM Cuentas_Por_Pagar WHERE id = ?', [idCxp]);
    check("la CxP nace 'pendiente' por el monto_principal, sin abonar", cxpInicial?.estado === 'pendiente' && near(cxpInicial?.valor_total, 4000000) && near(cxpInicial?.valor_pagado, 0), `row=${JSON.stringify(cxpInicial)}`);

    const [[catPrestamo]] = await db.query("SELECT id FROM Categorias_CxP WHERE nombre = 'Préstamo financiero'");
    r = await req('GET', `/pagos/cxp/mensual?mes=9&anio=2026&id_categoria=${catPrestamo?.id}`);
    const enCxp = (r.j?.data?.cuentas || []).find(c => c.id === idCxp);
    check('el préstamo SÍ aparece en /pagos/cxp/mensual como deuda pendiente', r.status === 200 && !!enCxp, `encontrado=${JSON.stringify(enCxp)}`);

    r = await req('POST', `/pagos/prestamos-financieros/${idDeudaReal}/abonos`, { valor: 1000000, fecha_abono: '2026-10-01', metodo_pago: 'transferencia' });
    check('abono registrado (201)', r.status === 201 && near(r.j?.data?.saldo_resultante, 3000000), `data=${JSON.stringify(r.j?.data)}`);

    const [[relTrasAbono]] = await db.query('SELECT COUNT(*) AS n FROM Cuentas_Por_Pagar_Relacion WHERE id_prestamo_fin = ?', [idDeudaReal]);
    check('sigue habiendo UNA sola CxP (no abrió una nueva por el abono)', relTrasAbono?.n === 1, `n=${relTrasAbono?.n}`);

    const [[cxpTrasAbono]] = await db.query('SELECT id, estado, valor_total, valor_pagado FROM Cuentas_Por_Pagar WHERE id = ?', [idCxp]);
    check("el abono se aplicó sobre la MISMA CxP (valor_pagado=1.000.000, sigue 'parcial')", cxpTrasAbono?.id === idCxp && cxpTrasAbono?.estado === 'parcial' && near(cxpTrasAbono?.valor_pagado, 1000000) && near(cxpTrasAbono?.valor_total, 4000000), `row=${JSON.stringify(cxpTrasAbono)}`);

    // La fecha base del interés es el último movimiento (el abono del 2026-10-01), no la fecha
    // de adquisición — hace falta un mes completo desde ESA fecha, no desde la adquisición.
    // Margen holgado (no 2026-11-01 exacto) para no caer en el límite por el parseo de fecha UTC.
    r = await req('POST', `/pagos/prestamos-financieros/${idDeudaReal}/interes`, { fecha: '2026-11-15' });
    const interesEsperado = 3000000 * 0.02; // saldo tras el abono (3M) * 2% * 1 mes
    check('interés capitalizado (201)', r.status === 201 && near(r.j?.data?.valor, interesEsperado), `data=${JSON.stringify(r.j?.data)}`);

    const [[cxpTrasInteres]] = await db.query('SELECT valor_total, valor_pagado FROM Cuentas_Por_Pagar WHERE id = ?', [idCxp]);
    check('el interés capitalizado sube valor_total de la MISMA CxP (sin tocar valor_pagado)', near(cxpTrasInteres?.valor_total, 4000000 + interesEsperado) && near(cxpTrasInteres?.valor_pagado, 1000000), `row=${JSON.stringify(cxpTrasInteres)}`);

    log('\n===== DELETE con guard (nuevo) =====');
    r = await req('DELETE', `/pagos/prestamos-financieros/${idIntacto}`);
    check('eliminar préstamo intacto (saldo==principal) → 200', r.status === 200, `status=${r.status}`);
    idIntacto = null;

    r = await req('POST', '/pagos/prestamos-financieros', {
        nombre_prestamo: `ZZ_TEST_PRESTAMO2_${RUN}`, fecha_adquisicion: '2026-09-19',
        monto_principal: 5000000, tasa_interes: 1.5, saldo_pendiente: 5000000
    });
    idConActividad = r.j?.data?.id;
    check('setup: 2do préstamo creado', r.status === 201 && !!idConActividad, `id=${idConActividad}`);

    await req('PATCH', `/pagos/prestamos-financieros/${idConActividad}`, { saldo_pendiente: 3000000 });

    r = await req('DELETE', `/pagos/prestamos-financieros/${idConActividad}`);
    check('eliminar préstamo con actividad (saldo!=principal) → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('DELETE', '/pagos/prestamos-financieros/9999999');
    check('eliminar préstamo inexistente → 404', r.status === 404, `status=${r.status}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Préstamos Financieros\n\n`;
    md += `> Generado por \`tests/pagos/prestamo_financiero.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_PRESTAMO_FINANCIERO_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
