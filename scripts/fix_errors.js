const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, search, replace) {
    const fullPath = path.join(__dirname, '../src', filePath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.split(search).join(replace);
        fs.writeFileSync(fullPath, content);
    }
}

// 1. Fix CategoriaCxcSQL
const filesCxc = [
    'interfaces/pagos/categoria_cxc.repository.interface.ts',
    'interfaces/pagos/categoria_cxc.service.interface.ts',
    'repositories/pagos/categoria_cxc.repository.ts',
    'services/pagos/categoria_cxc.service.ts'
];
filesCxc.forEach(f => replaceInFile(f, 'CategoriaCxCSQL', 'CategoriaCxcSQL'));

// 2. Fix CategoriaCxpSQL
const filesCxp = [
    'interfaces/pagos/categoria_cxp.repository.interface.ts',
    'interfaces/pagos/categoria_cxp.service.interface.ts',
    'repositories/pagos/categoria_cxp.repository.ts',
    'services/pagos/categoria_cxp.service.ts'
];
filesCxp.forEach(f => replaceInFile(f, 'CategoriaCxPSQL', 'CategoriaCxpSQL'));

// 3. Fix EmpleadoRepositoryInterface
replaceInFile('services/nomina/prestamo_empleado.service.ts', 'EmpleadoRepositoryInterface', 'IEmpleadoRepository');

// 4. Fix Proveedor model path
const filesProv = [
    'interfaces/material/proveedor.repository.interface.ts',
    'interfaces/material/proveedor.service.interface.ts',
    'repositories/material/proveedor.repository.ts',
    'services/material/proveedor.service.ts'
];
filesProv.forEach(f => replaceInFile(f, '../../models/material/sql/proveedor.sql', '../../models/pagos/sql/proveedor.sql'));

console.log('Fixes applied.');
