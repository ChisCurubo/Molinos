const fs = require('fs');
const tsNode = require('ts-node');

tsNode.register({ transpileOnly: true });

const { API_MAP } = require('../src/controllers/info/info.controller');
const { CONFIG } = require('../src/config/config');

const collection = {
    info: {
        name: API_MAP.nombre,
        description: API_MAP.descripcion,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: API_MAP.modulos.map(mod => {
        const folders = {};
        const rootItems = [];

        mod.endpoints.forEach(ep => {
            const subPath = mod.prefijo ? mod.prefijo.replace('/api/v1', '') : '';
            const routePath = ep.ruta.startsWith('/') ? ep.ruta : '/' + ep.ruta;
            const fullPath = `${subPath}${routePath}`;
            const request = {
                method: ep.metodo,
                header: [],
                url: {
                    raw: `{{base_url}}${fullPath}`,
                    host: ["{{base_url}}"],
                    path: fullPath.split('/').filter(p => p !== '')
                }
            };

            if (ep.requiere_token || mod.requiere_token) {
                request.auth = {
                    type: "bearer",
                    bearer: [
                        { key: "token", value: "{{token}}", type: "string" }
                    ]
                };
            }
            if (ep.headers) {
                 for (const [key, value] of Object.entries(ep.headers)) {
                     request.header.push({ key, value: String(value) });
                 }
            }
            if (ep.body) {
                request.header.push({ key: "Content-Type", value: "application/json" });
                request.body = {
                    mode: "raw",
                    raw: JSON.stringify(ep.body, null, 2),
                    options: { raw: { language: "json" } }
                };
            }
            if (ep.params) {
                request.url.query = Object.entries(ep.params).map(([key, value]) => ({
                    key,
                    value: String(value)
                }));
            }

            const postmanItem = {
                name: ep.descripcion,
                request
            };

            if (ep.grupo) {
                if (!folders[ep.grupo]) {
                    folders[ep.grupo] = { name: ep.grupo, item: [] };
                }
                folders[ep.grupo].item.push(postmanItem);
            } else {
                rootItems.push(postmanItem);
            }
        });

        return {
            name: mod.nombre,
            item: [...Object.values(folders), ...rootItems]
        };
    }),
    variable: [
        { key: "base_url", value: `http://localhost:${CONFIG.serverPort}/api/v1` },
        { key: "token", value: "" }
    ]
};

fs.writeFileSync('Molinos_Postman_Collection.json', JSON.stringify(collection, null, 2));
console.log('Colección Postman generada exitosamente.');
