/**
 * Test de endpoints de VISTAS MATERIAL (smoke; VistaMaterialController → VistaMaterialService, 2026-09-06).
 *  - GET /material/vistas/estado-pago-material[/:id_entrada]
 *  - GET /material/vistas/estado-pago-flete[/:id_entrada]
 *  - GET /material/vistas/excedente-empresa
 *  - GET /material/vistas/excedente-por-vehiculo[/:id_vehiculo]
 *  - GET /material/vistas/analisis-completo
 *  - GET /material/vistas/estado-agua
 *
 * Son vistas de BD de solo lectura: se valida status y forma de la respuesta.
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/vistas_material.entities.test.mjs
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

    log('\n===== estado-pago-material =====');
    r = await req('GET', '/material/vistas/estado-pago-material');
    check('GET /vistas/estado-pago-material (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);
    r = await req('GET', '/material/vistas/estado-pago-material/999999');
    check('GET .../:id_entrada inexistente (200, data null)', r.status === 200 && r.j?.data === null, `status=${r.status} data=${JSON.stringify(r.j?.data)}`);

    log('\n===== estado-pago-flete =====');
    r = await req('GET', '/material/vistas/estado-pago-flete');
    check('GET /vistas/estado-pago-flete (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);
    r = await req('GET', '/material/vistas/estado-pago-flete/999999');
    check('GET .../:id_entrada inexistente (200, data null)', r.status === 200 && r.j?.data === null);

    log('\n===== excedente-empresa =====');
    r = await req('GET', '/material/vistas/excedente-empresa');
    check('GET /vistas/excedente-empresa (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);

    log('\n===== excedente-por-vehiculo =====');
    r = await req('GET', '/material/vistas/excedente-por-vehiculo');
    check('GET /vistas/excedente-por-vehiculo (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);
    r = await req('GET', '/material/vistas/excedente-por-vehiculo/999999');
    check('GET .../:id_vehiculo inexistente (200, arreglo vacío)', r.status === 200 && Array.isArray(r.j?.data) && r.j.data.length === 0, `n=${r.j?.data?.length}`);

    log('\n===== analisis-completo (con filtros) =====');
    r = await req('GET', '/material/vistas/analisis-completo');
    check('GET /vistas/analisis-completo sin filtros (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);
    r = await req('GET', '/material/vistas/analisis-completo?id_mina=1&desde=2020-01-01&hasta=2030-01-01');
    check('GET /vistas/analisis-completo con filtros (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);

    log('\n===== estado-agua =====');
    r = await req('GET', '/material/vistas/estado-agua');
    check('GET /vistas/estado-agua (200, arreglo)', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — VISTAS MATERIAL\n\n`;
    md += `> Generado por \`tests/vistas_material.entities.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- GET /material/vistas/{estado-pago-material[/:id],estado-pago-flete[/:id],excedente-empresa,excedente-por-vehiculo[/:id],analisis-completo,estado-agua}\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_VISTAS_MATERIAL_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    process.exit(failN > 0 ? 1 : 0);
}
