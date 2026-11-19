/**
 * Test de RETENCIÓN EN LA FUENTE (Fase 1) + ReteIVA (Fase 2, "control básico", ACTIVADA) —
 * catálogo de conceptos, listado de lo aplicado, y el flag exento_retencion en Proveedores.
 *
 * Alcance Fase 1: SOLO Mulas (concepto 'Transporte de carga', 1%) y Alquiler (concepto
 * 'Arrendamiento muebles', 4%). Material/Minero y Flete·Agua/Dueno_Volqueta quedan fuera a
 * propósito — no se prueban aquí porque sus categorías de CxP no tienen id_concepto_retencion.
 *
 * Alcance Fase 2 (reteIVA): el concepto 'ReteIVA general' (15%) — decisión explícita del usuario,
 * 2026-10-31: se activó SIN confirmar todavía con un contador si Molinos es agente de reteIVA —
 * ver PLAN_RETENCIONES_FUENTE_IVA_2026-10-30.md. SOLO aplica a Alquiler (arrendamiento sí suele
 * llevar IVA); Mulas/transporte NO lleva reteIVA, solo retefuente — por eso no se prueba aquí.
 * Mientras esté activo, cualquier Alquiler con valor_iva > 0 (proveedor no exento) genera un 15%
 * adicional de retención REAL.
 *
 * Diseño "híbrido" (decisión del usuario, 2026-10-31): el catálogo sigue calculando la tarifa
 * automáticamente, pero se puede corregir a mano en DOS momentos — (a) AL CREAR el pago, con
 * retencion_fuente_manual/reteiva_manual en el body, o (b) DESPUÉS, vía PATCH — ver
 * migracion_retenciones_2026-10-31.sql. Los dos guardan el valor que el catálogo hubiera
 * calculado (valor_calculado_original) para no perder el rastro.
 *
 * Prueba:
 *  - GET   /pagos/retenciones            (catálogo: Transporte de carga + Arrendamiento muebles +
 *                                          ReteIVA general, las 3 ACTIVAS)
 *  - GET   /pagos/retenciones/aplicadas  (filtrable por id_cuenta_pagar/tipo/fecha)
 *  - POST  /pagos/alquileres con retencion_fuente_manual/reteiva_manual (override AL CREAR)
 *  - PATCH /pagos/retenciones/aplicadas/:id (ajuste manual DESPUÉS: recalcula la CxP, guarda el
 *          valor original, 409 si el ajuste deja el total por encima de valor_total)
 *  - PUT   /pagos/proveedores/:id        (declarante_renta/exento_retencion persisten)
 *  - Proveedor con exento_retencion=true → un Alquiler suyo NO genera NINGUNA retención (ni
 *    fuente ni iva), aunque tenga valor_iva > 0
 *  - Proveedor normal (no exento) → un Alquiler suyo genera retefuente (4%) + reteIVA (15%)
 *
 * Requisitos: server en :3005 + migracion_retenciones_2026-10-31.sql aplicada.
 * Uso:  node tests/pagos/retencion.endpoints.test.mjs
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
let idProveedorExento, idProveedorNormal, idTipo, idAlquilerExento, idAlquilerNormal, idAlquilerOverride;

async function cleanup() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        const alquileres = [idAlquilerExento, idAlquilerNormal, idAlquilerOverride].filter(Boolean);
        if (alquileres.length) {
            const inA = alquileres.map(() => '?').join(',');
            const [rel] = await db.query(`SELECT DISTINCT id_cuenta_pagar FROM Cuentas_Por_Pagar_Relacion WHERE id_alquiler IN (${inA})`, alquileres);
            const cuentas = rel.map(r => r.id_cuenta_pagar);
            if (cuentas.length) {
                const inCu = cuentas.map(() => '?').join(',');
                await db.query(`DELETE FROM Retenciones_Aplicadas WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Abonos_CxP WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar_Relacion WHERE id_cuenta_pagar IN (${inCu})`, cuentas);
                await db.query(`DELETE FROM Cuentas_Por_Pagar WHERE id IN (${inCu})`, cuentas);
            }
            await db.query(`DELETE FROM Alquileres WHERE id IN (${inA})`, alquileres);
        }
        if (idTipo) await db.query('DELETE FROM Tipos_Alquiler WHERE id = ?', [idTipo]);
        if (idProveedorExento) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedorExento]);
        if (idProveedorNormal) await db.query('DELETE FROM Proveedores WHERE id = ?', [idProveedorNormal]);
        await db.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) { log('  (cleanup warn):', e.message); }
}

try {
    log('\n===== AUTENTICACIÓN =====');
    let r = await req('POST', '/auth/login', { username: USER, password: PASS });
    TOKEN = r.j?.data?.token || '';
    check('login devuelve token', r.status === 200 && !!TOKEN, `status=${r.status}`);
    if (!TOKEN) throw new Error('Sin token');

    // ---------- Catálogo de conceptos (Fase 1) ----------
    log('\n===== GET /pagos/retenciones (catálogo) =====');
    r = await req('GET', '/pagos/retenciones');
    const conceptos = r.j?.data || [];
    const transporte = conceptos.find(c => c.nombre === 'Transporte de carga');
    const arrendamiento = conceptos.find(c => c.nombre === 'Arrendamiento muebles');
    check('catálogo incluye Transporte de carga (1%)', r.status === 200 && !!transporte && near(money(transporte.tarifa_declarante), 1) && near(money(transporte.tarifa_no_declarante), 1), `concepto=${JSON.stringify(transporte)}`);
    check('catálogo incluye Arrendamiento muebles (4%)', !!arrendamiento && near(money(arrendamiento.tarifa_declarante), 4) && near(money(arrendamiento.tarifa_no_declarante), 4), `concepto=${JSON.stringify(arrendamiento)}`);
    check('catálogo NO mezcla conceptos fuera de fase (Compras generales, Servicios generales, Honorarios)', !conceptos.some(c => ['Compras generales', 'Servicios generales', 'Honorarios'].includes(c.nombre)), `nombres=${conceptos.map(c => c.nombre)}`);

    // Fase 2 (reteIVA, "control básico"): activada por decisión explícita del usuario, 2026-10-31,
    // sin confirmar aún con un contador si corresponde legalmente — ver PLAN_RETENCIONES_FUENTE_IVA.
    const reteIva = conceptos.find(c => c.nombre === 'ReteIVA general');
    check('catálogo incluye ReteIVA general (15%) y está ACTIVO', !!reteIva && near(money(reteIva.tarifa_declarante), 15) && !!reteIva.activo, `concepto=${JSON.stringify(reteIva)}`);

    // ---------- Setup: proveedor EXENTO + proveedor NORMAL + tipo de alquiler ----------
    log('\n===== SETUP (proveedores + tipo) =====');
    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_RETEX_${RUN}`, exento_retencion: true });
    idProveedorExento = r.j?.data?.id;
    check('crea proveedor EXENTO de retención (201)', r.status === 201 && !!idProveedorExento && r.j?.data?.exento_retencion == 1, `exento=${r.j?.data?.exento_retencion}`);

    r = await req('POST', '/pagos/proveedores', { nombre: `ZZ_TEST_RETNORM_${RUN}` });
    idProveedorNormal = r.j?.data?.id;
    check('crea proveedor NORMAL (no exento, no declarante por defecto)', r.status === 201 && !!idProveedorNormal && !r.j?.data?.exento_retencion && !r.j?.data?.declarante_renta, `data=${JSON.stringify(r.j?.data)}`);

    // Confirma que declarante_renta/exento_retencion persisten en un PUT posterior.
    r = await req('PUT', `/pagos/proveedores/${idProveedorNormal}`, { declarante_renta: true });
    check('PUT /proveedores/:id persiste declarante_renta=true', r.status === 200 && r.j?.data?.declarante_renta == 1, `data=${JSON.stringify(r.j?.data)}`);
    // Para Arrendamiento muebles la tarifa es la misma declarante/no-declarante (4% flat),
    // así que el cambio de declarante_renta no debe alterar el monto retenido más abajo.

    r = await req('POST', '/pagos/alquileres/tipos', { nombre: `ZZ_TEST_TIPO_RET_${RUN}` });
    idTipo = r.j?.data?.id;
    check('crea tipo de alquiler de prueba', r.status === 201 && !!idTipo, `id=${idTipo}`);

    // ---------- Alquiler de proveedor EXENTO: no debe generar NINGUNA retención ----------
    log('\n===== ALQUILER DE PROVEEDOR EXENTO (ni fuente ni iva, aunque tenga valor_iva) =====');
    r = await req('POST', '/pagos/alquileres', { id_tipo: idTipo, id_proveedor: idProveedorExento, fecha_inicio: '2026-11-01', concepto: `ZZ_TEST_ALQ_EXENTO_${RUN}`, valor: 500000, valor_iva: 50000 });
    idAlquilerExento = r.j?.data?.id;
    check('crea alquiler del proveedor exento (con valor_iva)', r.status === 201 && !!idAlquilerExento, `id=${idAlquilerExento}`);

    r = await req('GET', `/pagos/alquileres/${idAlquilerExento}/estado-pago`);
    check('exento_retencion=true → valor_retenido=0 (ni 4% fuente ni 15% iva), saldo=valor_total', r.status === 200 && near(money(r.j?.data?.valor_retenido), 0) && near(money(r.j?.data?.saldo), 500000), `data=${JSON.stringify(r.j?.data)}`);

    // ---------- Alquiler de proveedor NORMAL: retefuente 4% + reteIVA 15% ----------
    log('\n===== ALQUILER DE PROVEEDOR NORMAL (retefuente 4% + reteIVA 15%, ambas activas) =====');
    // retefuente: 4% de 500000 = 20000. reteIVA: 15% de valor_iva (80000) = 12000. Total = 32000.
    r = await req('POST', '/pagos/alquileres', { id_tipo: idTipo, id_proveedor: idProveedorNormal, fecha_inicio: '2026-11-01', concepto: `ZZ_TEST_ALQ_NORMAL_${RUN}`, valor: 500000, valor_iva: 80000 });
    idAlquilerNormal = r.j?.data?.id;
    check('crea alquiler del proveedor normal (con valor_iva)', r.status === 201 && !!idAlquilerNormal && near(money(r.j?.data?.valor_iva), 80000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('GET', `/pagos/alquileres/${idAlquilerNormal}/estado-pago`);
    const idCuentaNormal = r.j?.data?.id_cuenta;
    check('retención combinada = 20000 (fuente) + 12000 (iva) = 32000, saldo=468000', r.status === 200 && near(money(r.j?.data?.valor_retenido), 32000) && near(money(r.j?.data?.saldo), 468000), `data=${JSON.stringify(r.j?.data)}`);

    // ---------- GET /pagos/retenciones/aplicadas ----------
    log('\n===== GET /pagos/retenciones/aplicadas =====');
    r = await req('GET', `/pagos/retenciones/aplicadas?id_cuenta_pagar=${idCuentaNormal}`);
    const aplicadas = r.j?.data || [];
    const fila4x = aplicadas.find(a => a.concepto === 'Arrendamiento muebles');
    const filaIva = aplicadas.find(a => a.concepto === 'ReteIVA general');
    check('aplicadas tiene 2 filas: fuente (Arrendamiento muebles, 20000) e iva (ReteIVA general, 12000)',
        r.status === 200 && aplicadas.length === 2 && !!fila4x && near(money(fila4x.valor_retenido), 20000) && fila4x.tipo === 'fuente'
        && !!filaIva && near(money(filaIva.valor_retenido), 12000) && filaIva.tipo === 'iva',
        `n=${aplicadas.length} data=${JSON.stringify(aplicadas)}`);

    r = await req('GET', `/pagos/retenciones/aplicadas?id_cuenta_pagar=${idCuentaNormal}&tipo=iva`);
    check('filtro tipo=iva sobre esta cuenta devuelve solo la fila de reteIVA (12000)', r.status === 200 && (r.j?.data || []).length === 1 && near(money(r.j?.data?.[0]?.valor_retenido), 12000), `data=${JSON.stringify(r.j?.data)}`);

    // ---------- Override manual DESDE LA CREACIÓN (retencion_fuente_manual / reteiva_manual) ----------
    log('\n===== Override manual al crear (retencion_fuente_manual=0, reteiva_manual=5000) =====');
    // Automático sería: fuente 4% de 300000=12000, iva 15% de 60000=9000. Forzamos fuente a 0
    // (no aplica) y iva a 5000 (un valor distinto al que hubiera calculado el catálogo).
    r = await req('POST', '/pagos/alquileres', {
        id_tipo: idTipo, id_proveedor: idProveedorNormal, fecha_inicio: '2026-11-01',
        concepto: `ZZ_TEST_ALQ_OVERRIDE_${RUN}`, valor: 300000, valor_iva: 60000,
        retencion_fuente_manual: 0, reteiva_manual: 5000
    });
    idAlquilerOverride = r.j?.data?.id;
    check('crea alquiler con override manual al crear (201)', r.status === 201 && !!idAlquilerOverride, `id=${idAlquilerOverride}`);

    r = await req('GET', `/pagos/alquileres/${idAlquilerOverride}/estado-pago`);
    check('valor_retenido = 0 (fuente forzada) + 5000 (iva forzada) = 5000, saldo=295000', r.status === 200 && near(money(r.j?.data?.valor_retenido), 5000) && near(money(r.j?.data?.saldo), 295000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('GET', `/pagos/retenciones/aplicadas?id_cuenta_pagar=${r.j?.data?.id_cuenta}`);
    const aplicadasOverride = r.j?.data || [];
    const fuenteOverride = aplicadasOverride.find(a => a.tipo === 'fuente');
    const ivaOverride = aplicadasOverride.find(a => a.tipo === 'iva');
    check('fuente quedó en 0 PERO ajustada (valor_calculado_original=12000, el que hubiera calculado el catálogo)',
        !!fuenteOverride && near(money(fuenteOverride.valor_retenido), 0) && fuenteOverride.ajustado_manualmente == 1 && near(money(fuenteOverride.valor_calculado_original), 12000),
        `fuente=${JSON.stringify(fuenteOverride)}`);
    check('iva quedó en 5000 (forzado) con valor_calculado_original=9000 (el 15% automático)',
        !!ivaOverride && near(money(ivaOverride.valor_retenido), 5000) && ivaOverride.ajustado_manualmente == 1 && near(money(ivaOverride.valor_calculado_original), 9000),
        `iva=${JSON.stringify(ivaOverride)}`);

    // ---------- PATCH /pagos/retenciones/aplicadas/:id (ajuste manual, diseño "híbrido") ----------
    log('\n===== PATCH /pagos/retenciones/aplicadas/:id (ajuste manual) =====');
    r = await req('PATCH', `/pagos/retenciones/aplicadas/${fila4x.id}`, { valor_retenido: 15000 });
    check('ajusta la retención de fuente a 15000, guarda valor_calculado_original=20000', r.status === 200 && near(money(r.j?.data?.valor_retenido), 15000) && r.j?.data?.ajustado_manualmente == 1 && near(money(r.j?.data?.valor_calculado_original), 20000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('GET', `/pagos/alquileres/${idAlquilerNormal}/estado-pago`);
    check('Cuentas_Por_Pagar.valor_retenido recalculado como SUMA real (15000+12000=27000), saldo=473000', r.status === 200 && near(money(r.j?.data?.valor_retenido), 27000) && near(money(r.j?.data?.saldo), 473000), `data=${JSON.stringify(r.j?.data)}`);

    r = await req('PATCH', `/pagos/retenciones/aplicadas/${fila4x.id}`, { valor_retenido: 999999999 });
    check('ajuste que deja el total por encima de valor_total → 409', r.status === 409, `status=${r.status} msg=${r.j?.message}`);

    r = await req('PATCH', `/pagos/retenciones/aplicadas/${fila4x.id}`, { valor_retenido: -5 });
    check('valor_retenido negativo → 400', r.status === 400, `status=${r.status}`);

    r = await req('PATCH', `/pagos/retenciones/aplicadas/999999999`, { valor_retenido: 1000 });
    check('ajustar una retención inexistente → 404', r.status === 404, `status=${r.status}`);

} catch (e) {
    check('ejecución sin excepciones', false, e.message + '\n' + (e.stack || ''));
} finally {
    await cleanup();
    const okN = results.filter(r => r.ok).length, failN = results.length - okN;
    const fecha = new Date().toISOString().slice(0, 10);
    let md = `# Reporte de pruebas — Retención en la Fuente (Fase 1) + ReteIVA (Fase 2, activa)\n\n`;
    md += `> Generado por \`tests/pagos/retencion.endpoints.test.mjs\` el ${fecha}. Base: ${BASE}\n\n`;
    md += `**Resultado: ${okN}/${results.length} OK${failN ? ` · ${failN} FALLOS` : ''}.**\n\n`;
    md += `| # | Check | Resultado | Detalle |\n|---|---|---|---|\n`;
    results.forEach((r, i) => { md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ OK' : '❌ FALLA'} | ${(r.detail || '').split('\n')[0]} |\n`; });
    md += `\n## Endpoints cubiertos\n`;
    md += `- GET /pagos/retenciones · GET /pagos/retenciones/aplicadas · PATCH /pagos/retenciones/aplicadas/:id\n`;
    md += `- POST /pagos/alquileres con retencion_fuente_manual/reteiva_manual (override al crear)\n`;
    md += `- PUT /pagos/proveedores/:id (declarante_renta/exento_retencion)\n`;
    md += `- Integración: POST /pagos/alquileres + GET /pagos/alquileres/:id/estado-pago (con y sin exención)\n`;
    fs.mkdirSync(path.resolve(process.cwd(), 'docs', 'pruebas'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), 'docs', 'pruebas', `REPORTE_PRUEBAS_RETENCION_${fecha}.md`), md);
    log(`\n===== RESULTADO: ${okN}/${results.length} OK, ${failN} FALLOS =====`);
    await db.end();
    process.exit(failN > 0 ? 1 : 0);
}
