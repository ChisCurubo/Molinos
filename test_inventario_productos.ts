// Prueba de humo end-to-end del módulo Inventario de productos (insumos), vía HTTP real
// (rutas + auth + controllers + services + repositories + BD). Requiere el servidor corriendo:
//   npm run dev        (otra terminal)
//   npx ts-node test_inventario_productos.ts
//
// Crea su propio producto de prueba (nombre con sufijo _TEST_<timestamp>) y lo borra al final
// (cascade borra también sus movimientos) — no toca productos reales existentes.

import assert from 'assert';
import mysql from 'mysql2/promise';
import { CONFIG } from './src/config/config';

const BASE = `http://localhost:${CONFIG.serverPort}/api/v1`;

async function login(): Promise<string> {
    const pool = mysql.createPool({
        host: CONFIG.dbHost, port: parseInt(CONFIG.dbPort as string), user: CONFIG.dbUser,
        password: CONFIG.dbPassword, database: CONFIG.dbName, connectionLimit: 1
    });
    const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT username, password_hash FROM Usuarios WHERE activo = 1 LIMIT 1');
    await pool.end();
    if (!rows.length) throw new Error('No hay usuarios activos para loguear la prueba');
    const { username, password_hash } = rows[0];
    const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: password_hash })
    });
    const json = await res.json();
    assert.strictEqual(res.status, 200, `login falló: ${JSON.stringify(json)}`);
    return json.data.token;
}

async function main() {
    const token = await login();
    const call = async (method: string, path: string, body?: any) => {
        const res = await fetch(`${BASE}${path}`, {
            method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        return { status: res.status, json: await res.json() };
    };

    const nombre = `Cal _TEST_${Date.now()}`;

    // 1. Crear producto
    let r = await call('POST', '/inventario-productos/productos', { nombre, categoria: 'quimico', unidad: 'kg', stock_minimo: 100 });
    assert.strictEqual(r.status, 201, JSON.stringify(r));
    const idProducto = r.json.data.id;
    assert.strictEqual(Number(r.json.data.stock_minimo), 100);
    console.log('OK  1. crear producto ->', idProducto);

    // 2. Producto recién creado: sin stock
    r = await call('GET', `/inventario-productos/productos/${idProducto}`);
    assert.strictEqual(Number(r.json.data.stock_actual), 0);
    console.log('OK  2. producto sin movimientos -> stock_actual=0');

    // 3. Entrada 1000 @ 10000
    r = await call('POST', '/inventario-productos/movimientos', { id_producto: idProducto, fecha: '2026-11-01', tipo: 'entrada', cantidad: 1000, costo_unitario: 10000 });
    assert.strictEqual(r.status, 201, JSON.stringify(r));
    const idEntrada1 = r.json.data.id;
    assert.strictEqual(Number(r.json.data.saldo_cantidad), 1000);
    assert.strictEqual(Number(r.json.data.saldo_valor), 10000000);
    console.log('OK  3. entrada 1000@10000 -> saldo 1000 / 10.000.000');

    // 4. Entrada 500 @ 16000 -> saldo 1500 / 18.000.000
    r = await call('POST', '/inventario-productos/movimientos', { id_producto: idProducto, fecha: '2026-11-02', tipo: 'entrada', cantidad: 500, costo_unitario: 16000 });
    assert.strictEqual(r.status, 201, JSON.stringify(r));
    assert.strictEqual(Number(r.json.data.saldo_cantidad), 1500);
    assert.strictEqual(Number(r.json.data.saldo_valor), 18000000);
    console.log('OK  4. entrada 500@16000 -> saldo 1500 / 18.000.000');

    // 5. GET productos: costo_promedio consolidado = 18.000.000 / 1500 = 12.000
    r = await call('GET', `/inventario-productos/productos/${idProducto}`);
    assert.strictEqual(Number(r.json.data.costo_promedio), 12000);
    assert.strictEqual(Number(r.json.data.stock_actual), 1500);
    console.log('OK  5. costo_promedio resuelto en catálogo = 12.000');

    // 6. Salida 300 -> debe costear al promedio (12.000), no a ninguno de los dos precios de compra
    r = await call('POST', '/inventario-productos/movimientos', { id_producto: idProducto, fecha: '2026-11-02', tipo: 'salida', cantidad: 300 });
    assert.strictEqual(r.status, 201, JSON.stringify(r));
    assert.strictEqual(Number(r.json.data.costo_unitario), 12000);
    assert.strictEqual(Number(r.json.data.costo_total), 3600000);
    assert.strictEqual(Number(r.json.data.saldo_cantidad), 1200);
    assert.strictEqual(Number(r.json.data.saldo_valor), 14400000);
    console.log('OK  6. salida 300 costeada a 12.000 -> saldo 1200 / 14.400.000');

    // 7. Salida que excede stock -> 400 STOCK_INSUFICIENTE
    r = await call('POST', '/inventario-productos/movimientos', { id_producto: idProducto, fecha: '2026-11-02', tipo: 'salida', cantidad: 99999 });
    assert.strictEqual(r.status, 400, JSON.stringify(r));
    assert.strictEqual(r.json.code, 'STOCK_INSUFICIENTE');
    console.log('OK  7. salida mayor al stock -> 400 STOCK_INSUFICIENTE');

    // 8. Borrar la entrada 1 (la de 1000@10000) -> debe recalcular los posteriores
    r = await call('DELETE', `/inventario-productos/movimientos/${idEntrada1}`);
    assert.strictEqual(r.status, 200, JSON.stringify(r));
    console.log('OK  8. borrar primera entrada');

    r = await call('GET', `/inventario-productos/movimientos?id_producto=${idProducto}`);
    const restantes = r.json.data;
    assert.strictEqual(restantes.length, 2);
    const [entrada2, salida1] = restantes;
    assert.strictEqual(Number(entrada2.saldo_cantidad), 500);
    assert.strictEqual(Number(entrada2.saldo_valor), 8000000);
    assert.strictEqual(Number(salida1.costo_unitario), 16000); // recalculado: ya no hay mezcla con la entrada borrada
    assert.strictEqual(Number(salida1.costo_total), 4800000);
    assert.strictEqual(Number(salida1.saldo_cantidad), 200);
    assert.strictEqual(Number(salida1.saldo_valor), 3200000);
    console.log('OK  9. recálculo de posteriores correcto tras el DELETE');

    // 10. Resumen: smoke check de forma (no de valores exactos, la BD puede tener otros productos)
    r = await call('GET', '/inventario-productos/resumen');
    assert.strictEqual(r.status, 200, JSON.stringify(r));
    assert.ok(r.json.data.total_productos >= 1);
    assert.ok('valor_total_inventario' in r.json.data && 'gastado_en_compras' in r.json.data);
    console.log('OK 10. /resumen responde con la forma esperada');

    // 11. Editar producto
    r = await call('PUT', `/inventario-productos/productos/${idProducto}`, { stock_minimo: 250 });
    assert.strictEqual(Number(r.json.data.stock_minimo), 250);
    console.log('OK 11. editar producto (stock_minimo)');

    // 12. Borrar producto -> cascade de movimientos
    r = await call('DELETE', `/inventario-productos/productos/${idProducto}`);
    assert.strictEqual(r.status, 200, JSON.stringify(r));
    r = await call('GET', `/inventario-productos/movimientos?id_producto=${idProducto}`);
    assert.strictEqual(r.json.data.length, 0);
    console.log('OK 12. borrar producto -> cascade borró sus movimientos');

    console.log('\nTODOS LOS TESTS PASARON (12/12)');
    process.exit(0);
}

main().catch(e => { console.error('FALLÓ:', e); process.exit(1); });
