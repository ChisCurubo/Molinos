/**
 * Test de endpoints de DEUDA + VISTAS PAGOS (smoke; DeudaController → DeudaService, 2026-09-06).
 *  - GET /pagos/deuda/material · /material/minero/:id · /flete · /flete/dueno/:id · /resumen-general
 *  - GET /pagos/vistas/estado-alquileres · estado-combustible · estado-mulas · saldos-a-favor
 *
 * Son dashboards de solo lectura sobre datos existentes: no se valida contenido exacto,
 * solo forma de la respuesta y status. La composición deuda_bruta/deuda_neta (antes en el
 * controller, ahora en DeudaService.deudaMaterialDeMinero) sí se valida aritméticamente.
 *
 * Requisitos: server en :3005, id_minero=1 y id_dueno_volqueta=1 existentes (seed).
 * Uso:  node tests/pagos/deuda_vistas_pagos.entities.test.mjs
 */
import fs from 'fs';
import path from 'path';
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

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== DEUDA MATERIAL =====');
    r = await req('GET', '/pagos/deuda/material');
    check('GET /deuda/material (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);

    r = await req('GET', '/pagos/deuda/material/minero/1');
    const dm = r.j?.data;
    check('GET /deuda/material/minero/:id (200, objeto compuesto)', r.status === 200 && dm && typeof dm === 'object', `body=${JSON.stringify(dm)}`);
    check('deuda_neta = max(deuda_bruta - saldo_a_favor, 0)', dm && near(money(dm.deuda_neta), Math.max(money(dm.deuda_bruta) - money(dm.saldo_a_favor), 0)), `neta=${dm?.deuda_neta} bruta=${dm?.deuda_bruta} saf=${dm?.saldo_a_favor}`);
    check('entradas es un arreglo', Array.isArray(dm?.entradas));

    log('\n===== DEUDA FLETE =====');
    r = await req('GET', '/pagos/deuda/flete');
    check('GET /deuda/flete (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);

    r = await req('GET', '/pagos/deuda/flete/dueno/1');
    check('GET /deuda/flete/dueno/:id (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);

    log('\n===== RESUMEN GENERAL =====');
    r = await req('GET', '/pagos/deuda/resumen-general');
    check('GET /deuda/resumen-general (200, objeto con totales)', r.status === 200 && r.j?.data && typeof r.j.data === 'object', `body=${JSON.stringify(r.j?.data)}`);
    check('trae deuda_total_material', r.j?.data?.deuda_total_material !== undefined);
    check('trae deuda_total_flete', r.j?.data?.deuda_total_flete !== undefined);

    log('\n===== VISTAS PAGOS (solo lectura) =====');
    r = await req('GET', '/pagos/vistas/estado-alquileres');
    check('GET /vistas/estado-alquileres (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data));

    r = await req('GET', '/pagos/vistas/estado-combustible');
    check('GET /vistas/estado-combustible (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data));

    r = await req('GET', '/pagos/vistas/estado-mulas');
    check('GET /vistas/estado-mulas (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data));

    r = await req('GET', '/pagos/vistas/saldos-a-favor');
    check('GET /vistas/saldos-a-favor (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data));

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — DEUDA + VISTAS PAGOS\n\n`;
    md += `> Generado por \`tests/pagos/deuda_vistas_pagos.entities.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- GET /pagos/deuda/{material,material/minero/:id,flete,flete/dueno/:id,resumen-general}\n`;
    md += `- GET /pagos/vistas/{estado-alquileres,estado-combustible,estado-mulas,saldos-a-favor}\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_DEUDA_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    process.exit(failN > 0 ? 1 : 0);
}
