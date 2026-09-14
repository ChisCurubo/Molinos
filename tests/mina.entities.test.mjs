/**
 * Test de endpoints de MINA / MINERO / ZONA / TARIFA-ZONA / PRECIO-MATERIAL (smoke + reglas clave).
 *  - CRUD mina, minero, zona, tarifa-zona, precio-material
 *  - Catálogos: /mina/catalogo/mineros, /mineros-con-minas, /catalogo/zonas
 *  - Rutas "legacy" migradas a MinaService: GET /mina/:id/entradas, GET /mina/:id/resumen
 *  - Regla: no se puede eliminar una zona en uso (409 ZONA_EN_USO)
 *
 * Requisitos: server en :3005.
 * Uso:  node tests/mina.entities.test.mjs
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

const RUN = String(Date.now()).slice(-6);
let idZona, idZona2, idMinero, idMina, idMina2, idTarifaZona, idPrecioMaterial;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        if (idPrecioMaterial) await db.query('DELETE FROM precio_material WHERE id = ?', [idPrecioMaterial]);
        if (idTarifaZona) await db.query('DELETE FROM tarifa_zona WHERE id = ?', [idTarifaZona]);
        if (idMina) await db.query('DELETE FROM mina WHERE id = ?', [idMina]);
        if (idMina2) await db.query('DELETE FROM mina WHERE id = ?', [idMina2]);
        if (idMinero) await db.query('DELETE FROM minero WHERE id = ?', [idMinero]);
        if (idZona) { await db.query('DELETE FROM tarifa_zona WHERE id_zona = ?', [idZona]); await db.query('DELETE FROM zona WHERE id = ?', [idZona]); }
        if (idZona2) { await db.query('DELETE FROM tarifa_zona WHERE id_zona = ?', [idZona2]); await db.query('DELETE FROM zona WHERE id = ?', [idZona2]); }
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    log('\n===== ZONA =====');
    r = await req('POST', '/material/mina/zona', { nombre: `ZZ_ZONA_${RUN}`, descripcion: 'Zona de prueba', valor_tonelada: 100000 });
    idZona = r.j?.data?.id ?? r.j?.data;
    check('POST /mina/zona crea zona (200; MinaController.ok() no usa 201)', r.status === 200 && !!idZona, `id=${idZona}`);

    r = await req('GET', '/material/mina/catalogo/zonas');
    check('GET /mina/catalogo/zonas incluye la nueva zona', (r.j?.data || []).some(z => Number(z.id) === Number(idZona)), `n=${r.j?.data?.length}`);

    r = await req('PUT', `/material/mina/zona/${idZona}`, { valor_tonelada: 120000 });
    check('PUT /mina/zona/:id versiona la tarifa (200)', r.status === 200, `status=${r.status}`);

    log('\n===== TARIFA-ZONA (CRUD dedicado) =====');
    r = await req('POST', '/material/mina/tarifa-zona', { id_zona: idZona, valor_tonelada: 130000, activo: true });
    idTarifaZona = r.j?.data?.id ?? r.j?.data;
    check('POST /mina/tarifa-zona crea tarifa (200)', r.status === 200 && !!idTarifaZona, `id=${idTarifaZona}`);
    r = await req('GET', '/material/mina/tarifa-zona');
    check('GET /mina/tarifa-zona lista', r.status === 200 && Array.isArray(r.j?.data), `n=${r.j?.data?.length}`);
    r = await req('GET', `/material/mina/tarifa-zona/${idTarifaZona}`);
    check('GET /mina/tarifa-zona/:id detalle', r.status === 200 && Number(r.j?.data?.id) === Number(idTarifaZona));
    r = await req('PUT', `/material/mina/tarifa-zona/${idTarifaZona}`, { valor_tonelada: 140000 });
    check('PUT /mina/tarifa-zona/:id actualiza (200)', r.status === 200, `status=${r.status}`);

    log('\n===== MINERO =====');
    r = await req('POST', '/material/mina/minero', { nombre: `ZZ_MINERO_${RUN}`, alias: `alias_${RUN}`, metodo_calculo: 'por_gramo', estado: 'activo' });
    idMinero = r.j?.data?.id ?? r.j?.data;
    check('POST /mina/minero crea minero (200)', r.status === 200 && !!idMinero, `id=${idMinero}`);

    r = await req('GET', '/material/mina/catalogo/mineros');
    check('GET catalogo/mineros incluye el nuevo minero', (r.j?.data || []).some(m => Number(m.id) === Number(idMinero)), `n=${r.j?.data?.length}`);

    r = await req('PUT', `/material/mina/minero/${idMinero}`, { alias: `alias2_${RUN}` });
    check('PUT /mina/minero/:id actualiza (200)', r.status === 200, `status=${r.status}`);

    log('\n===== MINA =====');
    r = await req('POST', '/material/mina', { nombre: `ZZ_MINA_${RUN}`, id_minero: idMinero, id_zona: idZona, ubicacion: 'Zaragoza', estado: 'activa' });
    idMina = r.j?.data?.id ?? r.j?.data;
    check('POST /mina crea mina (200)', r.status === 200 && !!idMina, `id=${idMina}`);

    r = await req('GET', '/material/mina');
    check('GET /mina lista incluye la nueva mina', (r.j?.data || []).some(m => Number(m.id) === Number(idMina)));

    r = await req('GET', `/material/mina/${idMina}`);
    check('GET /mina/:id detalle (200)', r.status === 200 && Number(r.j?.data?.id) === Number(idMina));

    r = await req('PUT', `/material/mina/${idMina}`, { ubicacion: 'Vereda Y' });
    check('PUT /mina/:id actualiza (200)', r.status === 200, `status=${r.status}`);

    r = await req('GET', '/material/mina/catalogo/mineros-con-minas');
    const mc = (r.j?.data || []).find(m => Number(m.id) === Number(idMinero));
    check('GET mineros-con-minas: el minero trae su mina anidada', mc && Array.isArray(mc.minas) && mc.minas.some(mm => Number(mm.id) === Number(idMina)), `minas=${JSON.stringify(mc?.minas)}`);

    log('\n===== RUTAS "LEGACY" MIGRADAS A MinaService (entradas / resumen) =====');
    r = await req('GET', `/material/mina/${idMina}/entradas`);
    check('GET /mina/:id/entradas (200, sin entradas aún)', r.status === 200 && Array.isArray(r.j?.data) && r.j.data.length === 0, `status=${r.status} n=${r.j?.data?.length}`);

    r = await req('GET', `/material/mina/${idMina}/resumen`);
    check('GET /mina/:id/resumen (200)', r.status === 200, `status=${r.status}`);

    r = await req('GET', '/material/mina/99999999');
    check('GET /mina/:id inexistente → 404', r.status === 404, `status=${r.status}`);

    log('\n===== PRECIO MATERIAL (CRUD referencial) =====');
    r = await req('POST', '/material/mina/precio-material', {
        id_minero: idMinero, id_zona: null, metodo: 'por_tonelada', precio_por_gramo: null,
        precio_por_tonelada: 650000, intervalo_tenor_min: 0, intervalo_tenor_max: 9999,
        fecha_inicio: '2026-08-01', fecha_fin: null, activo: true
    });
    idPrecioMaterial = r.j?.data?.id ?? r.j?.data;
    check('POST /mina/precio-material crea (200)', r.status === 200 && !!idPrecioMaterial, `id=${idPrecioMaterial}`);
    r = await req('GET', '/material/mina/precio-material');
    check('GET /mina/precio-material lista', r.status === 200 && Array.isArray(r.j?.data));
    r = await req('GET', `/material/mina/precio-material/${idPrecioMaterial}`);
    check('GET /mina/precio-material/:id detalle', r.status === 200 && Number(r.j?.data?.id) === Number(idPrecioMaterial));
    r = await req('PUT', `/material/mina/precio-material/${idPrecioMaterial}`, { precio_por_tonelada: 700000, activo: true });
    check('PUT /mina/precio-material/:id actualiza (200)', r.status === 200, `status=${r.status}`);
    r = await req('DELETE', `/material/mina/precio-material/${idPrecioMaterial}`);
    check('DELETE /mina/precio-material/:id (200)', r.status === 200, `status=${r.status}`);
    idPrecioMaterial = null;

    log('\n===== REGLA: ZONA_EN_USO (409 al borrar zona con minas) =====');
    r = await req('DELETE', `/material/mina/zona/${idZona}`);
    check('DELETE zona en uso → 409 ZONA_EN_USO', r.status === 409, `status=${r.status} body=${JSON.stringify(r.j)}`);

    log('\n===== LIMPIEZA vía API (delete mina → delete zona ya no bloqueado) =====');
    r = await req('DELETE', `/material/mina/${idMina}`);
    check('DELETE /mina/:id (200)', r.status === 200, `status=${r.status}`);
    idMina = null;

    r = await req('DELETE', `/material/mina/tarifa-zona/${idTarifaZona}`);
    check('DELETE /mina/tarifa-zona/:id (200)', r.status === 200, `status=${r.status}`);
    idTarifaZona = null;

    r = await req('DELETE', `/material/mina/zona/${idZona}`);
    check('DELETE zona sin minas ni tarifas → 200', r.status === 200, `status=${r.status}`);
    idZona = null;

    r = await req('DELETE', `/material/mina/minero/${idMinero}`);
    check('DELETE /mina/minero/:id (200)', r.status === 200, `status=${r.status}`);
    idMinero = null;

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — MINA / MINERO / ZONA / TARIFA-ZONA / PRECIO-MATERIAL\n\n`;
    md += `> Generado por \`tests/mina.entities.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- CRUD /material/mina, /mina/minero, /mina/zona, /mina/tarifa-zona, /mina/precio-material\n`;
    md += `- GET /mina/catalogo/mineros · /mina/catalogo/mineros-con-minas · /material/catalogo/zonas\n`;
    md += `- GET /mina/:id/entradas · /mina/:id/resumen (migradas de repo directo a MinaService)\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_MINA_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
