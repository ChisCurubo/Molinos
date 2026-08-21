/**
 * Añade el set completo de la FASE 3 (paneles de "editar material") a la carpeta
 * "2 - Material (entradas y minas)" de la colección Postman indicada por argumento:
 *   node scripts/add-fase3-to-collection.js "<archivo.postman_collection.json>"
 *
 * Items: PATCH precio (gramo/tonelada), GET/PATCH gastos-operativos,
 *        GET/PUT excedente, GET tipos-material (selector).
 * Idempotente: reemplaza esos items si ya existían. Preserva todo lo demás.
 */
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2];
if (!FILE) { console.error('Uso: node scripts/add-fase3-to-collection.js "<archivo.json>"'); process.exit(1); }
const abs = path.isAbsolute(FILE) ? FILE : path.join(process.cwd(), FILE);
const collection = JSON.parse(fs.readFileSync(abs, 'utf8'));

const json = (obj) => JSON.stringify(obj, null, 2);

function req(method, ruta, { body, desc } = {}) {
    const request = {
        method,
        header: [],
        url: { raw: `{{base_url}}/${ruta}`, host: ['{{base_url}}'], path: ruta.split('/').filter(Boolean) }
    };
    if (desc) request.description = desc;
    if (body) {
        request.header.push({ key: 'Content-Type', value: 'application/json' });
        request.body = { mode: 'raw', raw: json(body), options: { raw: { language: 'json' } } };
    }
    return request;
}
function item(name, request, testExec) {
    const it = { name, request, response: [] };
    if (testExec) it.event = [{ listen: 'test', script: { type: 'text/javascript', exec: testExec } }];
    return it;
}

const nuevos = [
    item('PATCH asignar precio (por gramo)',
        req('PATCH', 'material/entradas/{{id_entrada}}/precio', {
            desc: 'FASE 3 — Precio manual. Envia EXACTAMENTE uno de los dos precios (el otro queda NULL). precio_total = total_gramos * precio_por_gramo. Requiere Fase 2 completa (total_material_seco y total_gramos > 0) y que la entrada no este cancelada. Recalcula total_costos_operativos y total_material.',
            body: { precio_por_gramo: 72000 }
        }),
        [
            "pm.test('precio asignado (200)', () => pm.response.to.have.status(200));",
            "const j = pm.response.json();",
            "pm.test('precio_por_tonelada queda NULL', () => pm.expect(j.data.precio_por_tonelada).to.be.oneOf([null, 0, '0.00']));"
        ]),
    item('PATCH asignar precio (por tonelada)',
        req('PATCH', 'material/entradas/{{id_entrada}}/precio', {
            desc: 'FASE 3 — Precio manual alternativo. precio_total = total_material_seco * precio_por_tonelada. precio_por_gramo queda NULL. Enviar ambos o ninguno devuelve 400.',
            body: { precio_por_tonelada: 650000 }
        }),
        ["pm.test('precio asignado (200)', () => pm.response.to.have.status(200));"]),
    item('GET gastos operativos',
        req('GET', 'material/entradas/{{id_entrada}}/gastos-operativos', {
            desc: 'Desglose de costos (cargue/bascula/maquila/adicional/volqueta) + total_costos_operativos + total_material. Para precargar el panel.'
        }),
        ["pm.test('ok (200)', () => pm.response.to.have.status(200));"]),
    item('PATCH gastos operativos',
        req('PATCH', 'material/entradas/{{id_entrada}}/gastos-operativos', {
            desc: 'Edita solo los costos que cambian (los demás conservan su valor). Recalcula total_costos_operativos y total_material = precio_total + total_costos_operativos.',
            body: { costo_cargue: 300000, costo_adicional: 50000, costo_volqueta: 120000 }
        }),
        [
            "pm.test('gastos actualizados (200)', () => pm.response.to.have.status(200));",
            "const j = pm.response.json();",
            "pm.test('recalcula total_material', () => pm.expect(j.data).to.have.property('total_material'));"
        ]),
    item('GET excedente de la entrada',
        req('GET', 'material/entradas/{{id_entrada}}/excedente', {
            desc: 'Excedente registrado de la entrada (o null): valor_excedente, monto_distribuido, saldo_por_distribuir, estado_distribucion, concepto, notas.'
        }),
        ["pm.test('ok (200)', () => pm.response.to.have.status(200));"]),
    item('PUT registrar/actualizar excedente',
        req('PUT', 'material/entradas/{{id_entrada}}/excedente', {
            desc: 'Upsert 1:1: crea o actualiza el excedente de la entrada (tabla Excedente). saldo_por_distribuir lo calcula la BD. 409 si ya tiene distribucion o la entrada esta cancelada.',
            body: { valor_excedente: 1500000, fecha_calculo: '2026-08-16', concepto: 'Excedente entrada #{{id_entrada}}', notas: 'Registrado desde el panel de editar material' }
        }),
        ["pm.test('excedente guardado (200)', () => pm.response.to.have.status(200));"]),
    item('GET tipos de material (selector)',
        req('GET', 'material/tipos-material', {
            desc: 'Catalogo { id, nombre, descripcion } para el selector "Tipo de material (id)". Cacheable en el front (constante).'
        }),
        ["pm.test('ok (200)', () => pm.response.to.have.status(200));"])
];

const nombres = new Set(nuevos.map(n => n.name));
const folder = collection.item.find(it => it.name === '2 - Material (entradas y minas)');
if (!folder) throw new Error('No se encontro la carpeta "2 - Material (entradas y minas)" en ' + path.basename(abs));

folder.item = folder.item.filter(it => !nombres.has(it.name));
const idxCancelar = folder.item.findIndex(it => it.name === 'PATCH cancelar entrada');
const insertAt = idxCancelar >= 0 ? idxCancelar + 1 : folder.item.length;
folder.item.splice(insertAt, 0, ...nuevos);

fs.writeFileSync(abs, JSON.stringify(collection, null, 2), 'utf8');
console.log('OK:', path.basename(abs), '→ añadidos', nuevos.length, 'items en "2 - Material (entradas y minas)"');
