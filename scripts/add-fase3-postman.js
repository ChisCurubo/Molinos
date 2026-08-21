/**
 * Añade a la carpeta "2 - Material (entradas y minas)" los requests de la FASE 3
 * (paneles del formulario "editar material"):
 *   GET/PATCH gastos operativos, GET/PUT excedente, y el selector GET tipos-material.
 * Idempotente: reemplaza esos items si ya existían. Preserva todo lo demás.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'Molinos - Flujo 2.0 (Volquetas - Entradas - Analisis) Copy.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const json = (obj) => JSON.stringify(obj, null, 2);

function req(method, ruta, { body, desc } = {}) {
    const pathArr = ruta.split('/').filter(Boolean);
    const request = {
        method,
        header: [],
        url: { raw: `{{base_url}}/${ruta}`, host: ['{{base_url}}'], path: pathArr }
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
    // ---- Gastos operativos --------------------------------------------------
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

    // ---- Excedente (upsert 1:1) ---------------------------------------------
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

    // ---- Selector de tipos de material (cacheable) --------------------------
    item('GET tipos de material (selector)',
        req('GET', 'material/tipos-material', {
            desc: 'Catalogo { id, nombre, descripcion } para el selector "Tipo de material (id)". Cacheable en el front (constante).'
        }),
        ["pm.test('ok (200)', () => pm.response.to.have.status(200));"])
];

const nombres = new Set(nuevos.map(n => n.name));
const folder = collection.item.find(it => it.name === '2 - Material (entradas y minas)');
if (!folder) throw new Error('No se encontro la carpeta "2 - Material (entradas y minas)"');

// idempotencia
folder.item = folder.item.filter(it => !nombres.has(it.name));

// insertar despues del ultimo item de precio (o al final si no existe)
let insertAt = folder.item.map(it => it.name).lastIndexOf('PATCH asignar precio (por tonelada)');
insertAt = insertAt >= 0 ? insertAt + 1 : folder.item.length;
folder.item.splice(insertAt, 0, ...nuevos);

fs.writeFileSync(FILE, JSON.stringify(collection, null, 2), 'utf8');
console.log('Coleccion actualizada:', path.basename(FILE));
console.log('Requests añadidos:', nuevos.map(n => n.name).join(' | '));
