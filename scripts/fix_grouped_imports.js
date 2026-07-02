const fs = require('fs');
const path = require('path');

const groups = [
    { module: 'material', target: 'mina', originals: ['minero', 'zona', 'tarifa_zona'] },
    { module: 'material', target: 'volqueta', originals: ['dueno_volqueta'] },
    { module: 'material', target: 'analisis', originals: ['tipo_analisis'] },
    { module: 'material', target: 'material', originals: ['material_planta_entrada', 'tipo_material', 'precio_material', 'tarifa_calculo', 'proveedor'] },
    { module: 'nomina', target: 'empleado', originals: ['prestamo_empleado'] },
    { module: 'nomina', target: 'turno', originals: ['tipo_turno'] },
    // pagos
    { module: 'pagos', target: 'cxp', originals: ['cuentas_por_pagar', 'categoria_cxp'] },
    { module: 'pagos', target: 'cxc', originals: ['categoria_cxc'] },
    { module: 'pagos', target: 'gasto', originals: ['tipo_gasto_operativo'] },
    { module: 'pagos', target: 'alquiler', originals: ['tipo_alquiler'] },
    { module: 'pagos', target: 'proveedor', originals: ['categoria_proveedor'] }
];

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            for (const g of groups) {
                for (const orig of g.originals) {
                    // We look for imports containing the original name.
                    // E.g., `from '../../interfaces/material/minero.service.interface'`
                    // -> `from '../../interfaces/material/mina.service.interface'`
                    
                    const regexController = new RegExp(`(from\\s+['"].*?/${g.module}/)${orig}(.controller['"])`, 'g');
                    const regexService = new RegExp(`(from\\s+['"].*?/${g.module}/)${orig}(.service['"])`, 'g');
                    const regexRepo = new RegExp(`(from\\s+['"].*?/${g.module}/)${orig}(.repository['"])`, 'g');
                    const regexServiceInterface = new RegExp(`(from\\s+['"].*?/${g.module}/)${orig}(.service.interface['"])`, 'g');
                    const regexRepoInterface = new RegExp(`(from\\s+['"].*?/${g.module}/)${orig}(.repository.interface['"])`, 'g');

                    if (regexController.test(content) || regexService.test(content) || regexRepo.test(content) || regexServiceInterface.test(content) || regexRepoInterface.test(content)) {
                        content = content.replace(regexController, `$1${g.target}$2`);
                        content = content.replace(regexService, `$1${g.target}$2`);
                        content = content.replace(regexRepo, `$1${g.target}$2`);
                        content = content.replace(regexServiceInterface, `$1${g.target}$2`);
                        content = content.replace(regexRepoInterface, `$1${g.target}$2`);
                        modified = true;
                    }
                }
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated imports in: ${fullPath}`);
            }
        }
    }
}

processDirectory(path.join(__dirname, '../src'));
