const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../src');

const groups = [
    // --- MATERIAL ---
    {
        module: 'material',
        name: 'mina',
        files: ['mina', 'minero', 'zona', 'tarifa_zona']
    },
    {
        module: 'material',
        name: 'volqueta',
        files: ['dueno_volqueta']
    },
    {
        module: 'material',
        name: 'analisis',
        files: ['tipo_analisis']
    },
    {
        module: 'material',
        name: 'material',
        files: ['material_planta_entrada', 'tipo_material', 'precio_material', 'tarifa_calculo', 'proveedor']
    },
    // --- NOMINA ---
    {
        module: 'nomina',
        name: 'empleado',
        files: ['empleado', 'prestamo_empleado']
    },
    {
        module: 'nomina',
        name: 'turno',
        files: ['turno', 'tipo_turno']
    },
    {
        module: 'nomina',
        name: 'planta',
        files: ['planta']
    },
    // --- PAGOS ---
    {
        module: 'pagos',
        name: 'cxp',
        files: ['cuentas_por_pagar', 'categoria_cxp']
    },
    {
        module: 'pagos',
        name: 'cxc',
        files: ['categoria_cxc']
    },
    {
        module: 'pagos',
        name: 'gasto',
        files: ['tipo_gasto_operativo']
    },
    {
        module: 'pagos',
        name: 'alquiler',
        files: ['tipo_alquiler']
    },
    {
        module: 'pagos',
        name: 'proveedor',
        files: ['categoria_proveedor'] // Note: Proveedor is in material module currently
    }
];

function mergeFiles(layer, moduleName, groupName, files) {
    let allImports = new Set();
    let allCode = [];
    let filesFound = false;

    // We will parse out standard relative imports to fix them because they might overlap or be slightly different?
    // Actually, simple deduplication of exact import lines usually works.
    
    // Extractor regex
    const importRegex = /^import\s+.*?;?$/gm;

    for (const f of files) {
        let suffix = '';
        if (layer === 'interfaces') suffix = `.${layer.slice(0, -1)}`; // e.g. .interface (but wait, they are named .repository.interface.ts, .service.interface.ts)
        
        let ext = '.ts';
        if (layer === 'interfaces/repository') {
            ext = '.repository.interface.ts';
        } else if (layer === 'interfaces/service') {
            ext = '.service.interface.ts';
        } else if (layer === 'repositories') {
            ext = '.repository.ts';
        } else if (layer === 'services') {
            ext = '.service.ts';
        } else if (layer === 'controllers') {
            ext = '.controller.ts';
        }

        const realLayer = layer.startsWith('interfaces') ? 'interfaces' : layer;
        
        const filePath = path.join(BASE_DIR, realLayer, moduleName, f + ext);
        if (fs.existsSync(filePath)) {
            filesFound = true;
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Extract imports
            const imports = content.match(importRegex) || [];
            imports.forEach(i => allImports.add(i.trim()));
            
            // Extract code
            let code = content.replace(importRegex, '').trim();
            allCode.push(`// --- Original: ${f} ---\n` + code);
            
            // Delete old file
            fs.unlinkSync(filePath);
        }
    }

    if (!filesFound) return;

    // Handle duplicate express import specifically if it was written multi-line
    let importList = Array.from(allImports);
    
    // Group multiline imports (very naive, usually standard code uses single line)
    // If they used multiline, it might break. Assuming single line for generated CRUDs.

    // Calculate new filename
    let outExt = '.ts';
    if (layer === 'interfaces/repository') {
        outExt = '.repository.interface.ts';
    } else if (layer === 'interfaces/service') {
        outExt = '.service.interface.ts';
    } else if (layer === 'repositories') {
        outExt = '.repository.ts';
    } else if (layer === 'services') {
        outExt = '.service.ts';
    } else if (layer === 'controllers') {
        outExt = '.controller.ts';
    }
    const realLayer = layer.startsWith('interfaces') ? 'interfaces' : layer;
    const outPath = path.join(BASE_DIR, realLayer, moduleName, groupName + outExt);

    // Merge duplicate import items from the SAME path
    // For example: import { A } from './x'; import { B } from './x';
    // Let's do a basic Map to merge them.
    const importMap = new Map();
    for (const imp of importList) {
        const match = imp.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
        if (match) {
            const items = match[1].split(',').map(s => s.trim());
            const source = match[2];
            if (!importMap.has(source)) importMap.set(source, new Set());
            items.forEach(i => importMap.get(source).add(i));
        } else {
            // Keep default imports as is (assuming no duplicates for the same source)
            if (!importMap.has(imp)) importMap.set(imp, null);
        }
    }

    let finalImports = [];
    for (const [key, val] of importMap.entries()) {
        if (val === null) {
            finalImports.push(key);
        } else {
            finalImports.push(`import { ${Array.from(val).join(', ')} } from '${key}';`);
        }
    }

    const finalContent = finalImports.join('\n') + '\n\n' + allCode.join('\n\n');
    fs.writeFileSync(outPath, finalContent);
    console.log(`Created grouped file: ${outPath}`);
}

const layers = [
    'interfaces/repository',
    'interfaces/service',
    'repositories',
    'services',
    'controllers'
];

for (const group of groups) {
    for (const layer of layers) {
        mergeFiles(layer, group.module, group.name, group.files);
    }
}

console.log('Grouping complete.');
