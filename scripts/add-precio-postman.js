/**
 * Añade a la carpeta "2 - Material (entradas y minas)" los requests de la
 * FASE 3 — Precio manual:
 *   PATCH asignar precio (por gramo)
 *   PATCH asignar precio (por tonelada)
 * Endpoint: PATCH /material/entradas/:id/precio
 * Idempotente: reemplaza esos items si ya existían. Preserva todo lo demás.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'Molinos - Flujo 2.0 (Volquetas - Entradas - Analisis) Copy.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const json = (obj) => JSON.stringify(obj, null, 2);

function precioItem(name, body, desc, testExec) {
    const request = {
        method: 'PATCH',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: { mode: 'raw', raw: json(body), options: { raw: { language: 'json' } } },
        url: {
            raw: '{{base_url}}/material/entradas/{{id_entrada}}/precio',
            host: ['{{base_url}}'],
            path: ['material', 'entradas', '{{id_entrada}}', 'precio']
        }
    };
    if (desc) request.description = desc;
    const it = { name, request, response: [] };
    if (testExec) it.event = [{ listen: 'test', script: { type: 'text/javascript', exec: testExec } }];
    return it;
}

const nuevos = [
    precioItem(
        'PATCH asignar precio (por gramo)',
        { precio_por_gramo: 72000 },
        'FASE 3 — Precio manual. Envia EXACTAMENTE uno de los dos precios (el otro queda NULL). ' +
        'precio_total = total_gramos * precio_por_gramo. Requiere Fase 2 completa (total_material_seco y total_gramos > 0) ' +
        'y que la entrada no este cancelada. Recalcula total_costos_operativos y total_material.',
        [
            "pm.test('precio asignado (200)', () => pm.response.to.have.status(200));",
            "const j = pm.response.json();",
            "pm.test('precio_por_tonelada queda NULL', () => pm.expect(j.data.precio_por_tonelada).to.be.oneOf([null, 0, '0.00']));"
        ]
    ),
    precioItem(
        'PATCH asignar precio (por tonelada)',
        { precio_por_tonelada: 650000 },
        'FASE 3 — Precio manual alternativo. precio_total = total_material_seco * precio_por_tonelada. ' +
        'precio_por_gramo queda NULL. Enviar ambos o ninguno devuelve 400.',
        [
            "pm.test('precio asignado (200)', () => pm.response.to.have.status(200));"
        ]
    )
];

const nombres = new Set(nuevos.map(n => n.name));
const folder = collection.item.find(it => it.name === '2 - Material (entradas y minas)');
if (!folder) throw new Error('No se encontro la carpeta "2 - Material (entradas y minas)"');

// idempotencia: quitar versiones previas
folder.item = folder.item.filter(it => !nombres.has(it.name));

// insertar justo despues de "PATCH cancelar entrada" (o al final si no existe)
const idxCancelar = folder.item.findIndex(it => it.name === 'PATCH cancelar entrada');
const insertAt = idxCancelar >= 0 ? idxCancelar + 1 : folder.item.length;
folder.item.splice(insertAt, 0, ...nuevos);

fs.writeFileSync(FILE, JSON.stringify(collection, null, 2), 'utf8');
console.log('Coleccion actualizada:', path.basename(FILE));
console.log('Requests añadidos en "2 - Material (entradas y minas)":', nuevos.map(n => n.name).join(' | '));
