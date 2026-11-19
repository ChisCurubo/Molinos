/**
 * Test de endpoints de INFO (smoke).
 *  - GET /info            (apiMap)
 *  - GET /info/estadisticas
 *  - GET /info/health
 *  - GET /info/catalogos
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/info/info.entities.test.mjs
 */
import fs from 'fs';
import path from 'path';
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

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== GET /info (apiMap) =====');
    r = await req('GET', '/info');
    check('200 OK', r.status === 200, `status=${r.status}`);
    check('data.modulos es un arreglo no vacío', Array.isArray(r.j?.data?.modulos) && r.j.data.modulos.length > 0, `n=${r.j?.data?.modulos?.length}`);
    check('data.version presente', !!r.j?.data?.version, `version=${r.j?.data?.version}`);

    log('\n===== GET /info/estadisticas =====');
    r = await req('GET', '/info/estadisticas');
    check('200 OK', r.status === 200, `status=${r.status}`);
    check('data.total_entradas es numérico', typeof r.j?.data?.total_entradas === 'number', `total_entradas=${r.j?.data?.total_entradas}`);

    log('\n===== GET /info/health =====');
    r = await req('GET', '/info/health');
    check('200 OK', r.status === 200, `status=${r.status}`);
    check('data.db === true (BD conectada)', r.j?.data?.db === true, `db=${r.j?.data?.db}`);
    check('data.uptime es numérico', typeof r.j?.data?.uptime === 'number');

    log('\n===== GET /info/catalogos =====');
    r = await req('GET', '/info/catalogos');
    check('200 OK', r.status === 200, `status=${r.status}`);
    check('data es un objeto (catálogos en memoria)', r.j?.data && typeof r.j.data === 'object');

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — INFO\n\n`;
    md += `> Generado por \`tests/info/info.entities.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n- GET /info · GET /info/estadisticas · GET /info/health · GET /info/catalogos\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_INFO_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    process.exit(failN > 0 ? 1 : 0);
}
