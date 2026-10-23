/**
 * Test de endpoints de CONTRATOS DE ALQUILER (arriendo de larga duración, ej. 1 año) que
 * generan automáticamente un Alquileres (cobro mensual) por cada mes del período.
 *
 *  - GET/POST            /pagos/alquileres/contratos
 *  - GET/PUT/DELETE      /pagos/alquileres/contratos/:id
 *  - GET  /pagos/alquileres?id_contrato=&mes=&anio=  (filtros nuevos sobre el listado ya existente)
 *  - Integración con el motor de pago ya existente (POST /pagos/alquileres/:id/abonos)
 *
 * Requisitos: server en :3005 + migracion_contratos_alquiler_2026-10-18.sql aplicada.
 * Uso:  node tests/pagos/contrato_alquiler.endpoints.test.mjs
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

const RUN = String(Date.now()).slice(-6);
let idProveedor, idTipo, idContrato, idContratoClamp;

async function limpiarContrato(id) {
    if (!id) return;
    const [alq] = await db.query('SELECT id FROM Alquileres WHERE id_contrato = ?', [id]);
    const ids = alq.map(r => r.id);
    if (ids.length) {
        const inA = ids.map(() => '?').join(',');
        const [rel] = await db.query(`SELECT DISTINCT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_alquiler IN (${inA})`, ids);
        const cuentas = rel.map(r => r.id_cuenta_pagar);
        if (cuentas.length) {
            const inCu = cuentas.map(() => '?').join(',');
            await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
            await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
            await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
        }
        await db.query(`DELETE FROM Alquileres WHERE id IN (${inA})`, ids);
    }
    await db.query('DELETE FROM Contratos_Alquiler WHERE id = ?', [id]);
}

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        await limpiarContrato(idContrato);
        await limpiarContrato(idContratoClamp);
        if (idTipo) await db.query('DELETE FROM Tipos_Alquiler WHERE id = ?', [idTipo]);
        if (idProveedor) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedor]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== SETUP (proveedor + tipo de prueba) =====');
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_ARRENDADOR_CONTRATO_${RUN}`, alias: 'zzarrc', estado: 'activo' });
    idProveedor = r.j?.data?.id ?? r.j?.id;
    check('crea proveedor de prueba', r.status === 201 && !!idProveedor, `id=${idProveedor}`);

    r = await req('POST', '/pagos/alquileres/tipos', { nombre: `ZZ_TEST_TIPO_CONTRATO_${RUN}` });
    idTipo = r.j?.data?.id;
    check('crea tipo de alquiler de prueba', r.status === 201 && !!idTipo, `id=${idTipo}`);

    // ---------- Validaciones ----------
    log('\n===== VALIDACIONES =====');
    r = await req('POST', '/pagos/alquileres/contratos', { id_proveedor: idProveedor, concepto: 'x', valor_mensual: 100000, fecha_inicio: '2027-01-01', fecha_fin: '2026-01-01' });
    check('fecha_fin anterior a fecha_inicio → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/alquileres/contratos', { id_proveedor: idProveedor, concepto: 'x', valor_mensual: 0, fecha_inicio: '2026-01-01', fecha_fin: '2027-01-01' });
    check('valor_mensual=0 → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    r = await req('POST', '/pagos/alquileres/contratos', { concepto: 'x', valor_mensual: 100000, fecha_inicio: '2026-01-01', fecha_fin: '2027-01-01' });
    check('sin id_proveedor → 400', r.status === 400, `status=${r.status} msg=${r.j?.message}`);

    // ---------- Crear contrato de 3 meses (Nov, Dic, Ene) ----------
    log('\n===== CREAR CONTRATO (3 MESES) =====');
    r = await req('POST', '/pagos/alquileres/contratos', {
        id_tipo: idTipo, id_proveedor: idProveedor,
        concepto: `ZZ_TEST_CONTRATO_${RUN}`, valor_mensual: 1000000,
        fecha_inicio: '2026-11-01', fecha_fin: '2027-01-31'
    });
    idContrato = r.j?.data?.contrato?.id;
    const mesesCreados = r.j?.data?.meses || [];
    check('POST /contratos crea el contrato y genera 3 meses', r.status === 201 && !!idContrato && mesesCreados.length === 3, `id=${idContrato} n=${mesesCreados.length}`);
    check('cada mes tiene valor=1000000 e id_contrato correcto', mesesCreados.every(m => money(m.valor) === 1000000 && m.id_contrato === idContrato));
    check('el concepto de cada mes incluye el nombre del mes', /Noviembre/.test(mesesCreados[0]?.concepto || '') && /Diciembre/.test(mesesCreados[1]?.concepto || '') && /Enero/.test(mesesCreados[2]?.concepto || ''), `conceptos=${mesesCreados.map(m => m.concepto)}`);

    // ---------- Detalle del contrato ----------
    log('\n===== DETALLE DEL CONTRATO =====');
    r = await req('GET', `/pagos/alquileres/contratos/${idContrato}`);
    check('GET /contratos/:id devuelve contrato + 3 meses', r.status === 200 && r.j?.data?.contrato?.id === idContrato && r.j?.data?.meses?.length === 3, `n=${r.j?.data?.meses?.length}`);

    // ---------- Filtros nuevos sobre GET /alquileres ----------
    log('\n===== FILTROS GET /alquileres?id_contrato= =====');
    r = await req('GET', `/pagos/alquileres?id_contrato=${idContrato}`);
    check('GET /alquileres?id_contrato= devuelve los 3 meses', r.status === 200 && (r.j?.data || []).length === 3, `n=${r.j?.data?.length}`);

    r = await req('GET', `/pagos/alquileres?id_contrato=${idContrato}&mes=12&anio=2026`);
    const soloDic = r.j?.data || [];
    check('filtro mes=12&anio=2026 devuelve solo diciembre', r.status === 200 && soloDic.length === 1 && /Diciembre/.test(soloDic[0]?.concepto || ''), `n=${soloDic.length} concepto=${soloDic[0]?.concepto}`);

    // ---------- Integración con el motor de pago ya existente ----------
    log('\n===== PAGAR UNO DE LOS MESES GENERADOS =====');
    const idMesNoviembre = mesesCreados[0].id;
    r = await req('POST', `/pagos/alquileres/${idMesNoviembre}/abonos`, { valor: 1000000, comprobante_url: 'https://x/contrato-nov.png' });
    check('se puede pagar un mes generado por el contrato con el endpoint normal', r.status === 201 && r.j?.data?.cuenta?.estado === 'pagado', `estado=${r.j?.data?.cuenta?.estado}`);

    // ---------- Editar metadata del contrato (NO debe tocar los meses) ----------
    log('\n===== EDITAR CONTRATO (SOLO METADATA) =====');
    r = await req('PUT', `/pagos/alquileres/contratos/${idContrato}`, { contrato_url: 'https://x/contrato-firmado.pdf' });
    check('PUT /contratos/:id guarda el contrato_url', r.status === 200 && r.j?.data?.contrato_url === 'https://x/contrato-firmado.pdf', `url=${r.j?.data?.contrato_url}`);

    r = await req('GET', `/pagos/alquileres?id_contrato=${idContrato}`);
    check('tras editar el contrato siguen siendo 3 meses (no se regeneraron/duplicaron)', (r.j?.data || []).length === 3, `n=${r.j?.data?.length}`);

    // ---------- Anular contrato (no debe tocar los meses ya generados) ----------
    log('\n===== ANULAR CONTRATO =====');
    r = await req('DELETE', `/pagos/alquileres/contratos/${idContrato}`);
    check('DELETE /contratos/:id anula (200)', r.status === 200, `status=${r.status}`);

    r = await req('GET', '/pagos/alquileres/contratos');
    check('contrato anulado ya no aparece en el listado de contratos', !(r.j?.data || []).some(c => c.id === idContrato), `n=${r.j?.data?.length}`);

    r = await req('GET', `/pagos/alquileres?id_contrato=${idContrato}`);
    check('los 3 meses generados SIGUEN existiendo tras anular el contrato', (r.j?.data || []).length === 3, `n=${r.j?.data?.length}`);

    // ---------- Recorte de día (ancla el 31, cruza febrero) ----------
    log('\n===== RECORTE DE DÍA (ANCLA 31, CRUZA FEBRERO) =====');
    r = await req('POST', '/pagos/alquileres/contratos', {
        id_tipo: idTipo, id_proveedor: idProveedor,
        concepto: `ZZ_TEST_CLAMP_${RUN}`, valor_mensual: 200000,
        fecha_inicio: '2026-01-31', fecha_fin: '2026-03-31'
    });
    idContratoClamp = r.j?.data?.contrato?.id;
    const mesesClamp = (r.j?.data?.meses || []).map(m => String(m.fecha_inicio).slice(0, 10));
    check('ancla el día 31: ene-31, feb-28 (recortado), mar-31', r.status === 201 && mesesClamp.length === 3 && mesesClamp[0] === '2026-01-31' && mesesClamp[1] === '2026-02-28' && mesesClamp[2] === '2026-03-31', `fechas=${mesesClamp.join(',')}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Contratos de Alquiler (generación mensual automática)\n\n`;
    md += `> Generado por \`tests/pagos/contrato_alquiler.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- GET/POST /pagos/alquileres/contratos · GET/PUT/DELETE /pagos/alquileres/contratos/:id\n`;
    md += `- GET /pagos/alquileres?id_contrato=&mes=&anio= (filtros nuevos)\n`;
    md += `- Integración con POST /pagos/alquileres/:id/abonos sobre un mes generado\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_CONTRATO_ALQUILER_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
