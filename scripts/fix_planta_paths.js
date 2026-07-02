const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, searchStr, replaceStr) {
    const fullPath = path.join(__dirname, '../src', filePath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.split(searchStr).join(replaceStr);
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${filePath}`);
    } else {
        console.log(`File not found: ${filePath}`);
    }
}

const files = [
    'interfaces/nomina/planta.repository.interface.ts',
    'interfaces/nomina/planta.service.interface.ts',
    'repositories/nomina/planta.repository.ts',
    'services/nomina/planta.service.ts',
    'controllers/nomina/planta.controller.ts',
    'routes/nomina/planta.routes.ts'
];

files.forEach(f => replaceInFile(f, '/material/', '/nomina/'));
