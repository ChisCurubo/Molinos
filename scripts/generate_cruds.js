const fs = require('fs');
const path = require('path');

const configs = [
    // --- MATERIAL ---
    { module: 'material', entityName: 'TipoMaterial', tableName: 'Tipos_Material', fileName: 'tipo_material', routeBase: 'tipos-material' },
    { module: 'material', entityName: 'TipoAnalisis', tableName: 'Tipos_Analisis', fileName: 'tipo_analisis', routeBase: 'tipos-analisis' },
    { module: 'material', entityName: 'TarifaCalculo', tableName: 'Tarifas_Calculo', fileName: 'tarifa_calculo', routeBase: 'tarifas-calculo' },
    { module: 'material', entityName: 'Planta', tableName: 'Planta', fileName: 'planta', routeBase: 'plantas' },
    { module: 'material', entityName: 'Zona', tableName: 'Zona', fileName: 'zona', routeBase: 'zonas' },
    { module: 'material', entityName: 'TarifaZona', tableName: 'Tarifa_Zona', fileName: 'tarifa_zona', routeBase: 'tarifas-zona' },
    { module: 'material', entityName: 'Minero', tableName: 'Minero', fileName: 'minero', routeBase: 'mineros' },
    { module: 'material', entityName: 'DuenoVolqueta', tableName: 'Dueno_Volqueta', fileName: 'dueno_volqueta', routeBase: 'duenos-volqueta' },
    { module: 'material', entityName: 'Proveedor', tableName: 'Proveedores', fileName: 'proveedor', routeBase: 'proveedores' },
    { module: 'material', entityName: 'Mina', tableName: 'Mina', fileName: 'mina', routeBase: 'minas' },
    { module: 'material', entityName: 'PrecioMaterial', tableName: 'Precio_Material', fileName: 'precio_material', routeBase: 'precios-material' },

    // --- PAGOS ---
    { module: 'pagos', entityName: 'TipoGastoOperativo', tableName: 'Tipos_Gasto_Operativo', fileName: 'tipo_gasto_operativo', routeBase: 'tipos-gasto-operativo' },
    { module: 'pagos', entityName: 'TipoAlquiler', tableName: 'Tipos_Alquiler', fileName: 'tipo_alquiler', routeBase: 'tipos-alquiler' },
    { module: 'pagos', entityName: 'CategoriaProveedor', tableName: 'Categorias_Proveedor', fileName: 'categoria_proveedor', routeBase: 'categorias-proveedor' },
    { module: 'pagos', entityName: 'CategoriaCxP', tableName: 'Categorias_CxP', fileName: 'categoria_cxp', routeBase: 'categorias-cxp' },
    { module: 'pagos', entityName: 'CategoriaCxC', tableName: 'Categorias_CxC', fileName: 'categoria_cxc', routeBase: 'categorias-cxc' },

    // --- NOMINA ---
    { module: 'nomina', entityName: 'TipoTurno', tableName: 'Tipos_Turno', fileName: 'tipo_turno', routeBase: 'tipos-turno' },
    { module: 'nomina', entityName: 'Empleado', tableName: 'Empleados', fileName: 'empleado', routeBase: 'empleados' },
    { module: 'nomina', entityName: 'Turno', tableName: 'Turnos', fileName: 'turno', routeBase: 'turnos' },
];

const BASE_DIR = path.join(__dirname, '../src');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function generateInterfaceRepo(config) {
    const content = "import { " + config.entityName + "SQL } from '../../models/" + config.module + "/sql/" + config.fileName + ".sql';\n" +
"\n" +
"export interface I" + config.entityName + "Repository {\n" +
"    create(data: Omit<" + config.entityName + "SQL, 'id'>): Promise<number>;\n" +
"    getById(id: number): Promise<" + config.entityName + "SQL | null>;\n" +
"    update(id: number, data: Partial<" + config.entityName + "SQL>): Promise<boolean>;\n" +
"    delete(id: number): Promise<boolean>;\n" +
"    list(): Promise<" + config.entityName + "SQL[]>;\n" +
"}\n";
    const p = path.join(BASE_DIR, 'interfaces', config.module, config.fileName + '.repository.interface.ts');
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, content);
}

function generateInterfaceService(config) {
    const content = "import { " + config.entityName + "SQL } from '../../models/" + config.module + "/sql/" + config.fileName + ".sql';\n" +
"\n" +
"export interface I" + config.entityName + "Service {\n" +
"    create(data: any): Promise<" + config.entityName + "SQL>;\n" +
"    getById(id: number): Promise<" + config.entityName + "SQL | null>;\n" +
"    update(id: number, data: any): Promise<" + config.entityName + "SQL | null>;\n" +
"    delete(id: number): Promise<boolean>;\n" +
"    list(): Promise<" + config.entityName + "SQL[]>;\n" +
"}\n";
    const p = path.join(BASE_DIR, 'interfaces', config.module, config.fileName + '.service.interface.ts');
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, content);
}

function generateRepo(config) {
    const content = "import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';\n" +
"import Database from '../../config/database.config';\n" +
"import { " + config.entityName + "SQL } from '../../models/" + config.module + "/sql/" + config.fileName + ".sql';\n" +
"import { I" + config.entityName + "Repository } from '../../interfaces/" + config.module + "/" + config.fileName + ".repository.interface';\n" +
"\n" +
"export class " + config.entityName + "Repository implements I" + config.entityName + "Repository {\n" +
"    async create(data: Omit<" + config.entityName + "SQL, 'id'>): Promise<number> {\n" +
"        const db = Database.getInstance();\n" +
"        const fields = Object.keys(data);\n" +
"        const values = Object.values(data);\n" +
"        const placeholders = fields.map(() => '?').join(', ');\n" +
"        \n" +
"        const [result] = await db.query<ResultSetHeader>(\n" +
"            `INSERT INTO " + config.tableName + " (${fields.join(', ')}) VALUES (${placeholders})`,\n" +
"            values\n" +
"        );\n" +
"        return result.insertId;\n" +
"    }\n" +
"\n" +
"    async getById(id: number): Promise<" + config.entityName + "SQL | null> {\n" +
"        const db = Database.getInstance();\n" +
"        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM " + config.tableName + " WHERE id = ?', [id]);\n" +
"        if (rows.length === 0) return null;\n" +
"        return rows[0] as " + config.entityName + "SQL;\n" +
"    }\n" +
"\n" +
"    async update(id: number, data: Partial<" + config.entityName + "SQL>): Promise<boolean> {\n" +
"        const db = Database.getInstance();\n" +
"        const fields: string[] = [];\n" +
"        const values: any[] = [];\n" +
"        \n" +
"        for (const [key, value] of Object.entries(data)) {\n" +
"            if (value !== undefined) {\n" +
"                fields.push(`${key} = ?`);\n" +
"                values.push(value);\n" +
"            }\n" +
"        }\n" +
"        \n" +
"        if (fields.length === 0) return false;\n" +
"        values.push(id);\n" +
"        \n" +
"        const query = `UPDATE " + config.tableName + " SET ${fields.join(', ')} WHERE id = ?`;\n" +
"        const [result] = await db.query<ResultSetHeader>(query, values);\n" +
"        return result.affectedRows > 0;\n" +
"    }\n" +
"\n" +
"    async delete(id: number): Promise<boolean> {\n" +
"        const db = Database.getInstance();\n" +
"        const [result] = await db.query<ResultSetHeader>('DELETE FROM " + config.tableName + " WHERE id = ?', [id]);\n" +
"        return result.affectedRows > 0;\n" +
"    }\n" +
"\n" +
"    async list(): Promise<" + config.entityName + "SQL[]> {\n" +
"        const db = Database.getInstance();\n" +
"        const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM " + config.tableName + "');\n" +
"        return rows as " + config.entityName + "SQL[];\n" +
"    }\n" +
"}\n";
    const p = path.join(BASE_DIR, 'repositories', config.module, config.fileName + '.repository.ts');
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, content);
}

function generateService(config) {
    const content = "import { I" + config.entityName + "Service } from '../../interfaces/" + config.module + "/" + config.fileName + ".service.interface';\n" +
"import { I" + config.entityName + "Repository } from '../../interfaces/" + config.module + "/" + config.fileName + ".repository.interface';\n" +
"import { " + config.entityName + "Repository } from '../../repositories/" + config.module + "/" + config.fileName + ".repository';\n" +
"import { " + config.entityName + "SQL } from '../../models/" + config.module + "/sql/" + config.fileName + ".sql';\n" +
"\n" +
"export class " + config.entityName + "Service implements I" + config.entityName + "Service {\n" +
"    private repository: I" + config.entityName + "Repository;\n" +
"\n" +
"    constructor() {\n" +
"        this.repository = new " + config.entityName + "Repository();\n" +
"    }\n" +
"\n" +
"    async create(data: any): Promise<" + config.entityName + "SQL> {\n" +
"        const id = await this.repository.create(data);\n" +
"        const entity = await this.repository.getById(id);\n" +
"        return entity!;\n" +
"    }\n" +
"\n" +
"    async getById(id: number): Promise<" + config.entityName + "SQL | null> {\n" +
"        return this.repository.getById(id);\n" +
"    }\n" +
"\n" +
"    async update(id: number, data: any): Promise<" + config.entityName + "SQL | null> {\n" +
"        await this.repository.update(id, data);\n" +
"        return this.repository.getById(id);\n" +
"    }\n" +
"\n" +
"    async delete(id: number): Promise<boolean> {\n" +
"        return this.repository.delete(id);\n" +
"    }\n" +
"\n" +
"    async list(): Promise<" + config.entityName + "SQL[]> {\n" +
"        return this.repository.list();\n" +
"    }\n" +
"}\n";
    const p = path.join(BASE_DIR, 'services', config.module, config.fileName + '.service.ts');
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, content);
}

function generateController(config) {
    const content = "import { Request, Response } from 'express';\n" +
"import { I" + config.entityName + "Service } from '../../interfaces/" + config.module + "/" + config.fileName + ".service.interface';\n" +
"import { " + config.entityName + "Service } from '../../services/" + config.module + "/" + config.fileName + ".service';\n" +
"\n" +
"export class " + config.entityName + "Controller {\n" +
"    private service: I" + config.entityName + "Service;\n" +
"\n" +
"    constructor() {\n" +
"        this.service = new " + config.entityName + "Service();\n" +
"    }\n" +
"\n" +
"    create = async (req: Request, res: Response): Promise<void> => {\n" +
"        try {\n" +
"            const result = await this.service.create(req.body);\n" +
"            res.status(201).json({ success: true, data: result });\n" +
"        } catch (error: any) {\n" +
"            res.status(500).json({ success: false, error: error.message });\n" +
"        }\n" +
"    };\n" +
"\n" +
"    getById = async (req: Request, res: Response): Promise<void> => {\n" +
"        try {\n" +
"            const id = parseInt(req.params.id as string, 10);\n" +
"            const result = await this.service.getById(id);\n" +
"            if (!result) {\n" +
"                res.status(404).json({ success: false, error: 'Registro no encontrado' });\n" +
"                return;\n" +
"            }\n" +
"            res.status(200).json({ success: true, data: result });\n" +
"        } catch (error: any) {\n" +
"            res.status(500).json({ success: false, error: error.message });\n" +
"        }\n" +
"    };\n" +
"\n" +
"    update = async (req: Request, res: Response): Promise<void> => {\n" +
"        try {\n" +
"            const id = parseInt(req.params.id as string, 10);\n" +
"            const result = await this.service.update(id, req.body);\n" +
"            if (!result) {\n" +
"                res.status(404).json({ success: false, error: 'Registro no encontrado o sin cambios' });\n" +
"                return;\n" +
"            }\n" +
"            res.status(200).json({ success: true, data: result });\n" +
"        } catch (error: any) {\n" +
"            res.status(500).json({ success: false, error: error.message });\n" +
"        }\n" +
"    };\n" +
"\n" +
"    delete = async (req: Request, res: Response): Promise<void> => {\n" +
"        try {\n" +
"            const id = parseInt(req.params.id as string, 10);\n" +
"            const deleted = await this.service.delete(id);\n" +
"            if (!deleted) {\n" +
"                res.status(404).json({ success: false, error: 'Registro no encontrado' });\n" +
"                return;\n" +
"            }\n" +
"            res.status(200).json({ success: true, message: 'Registro eliminado' });\n" +
"        } catch (error: any) {\n" +
"            res.status(500).json({ success: false, error: error.message });\n" +
"        }\n" +
"    };\n" +
"\n" +
"    list = async (req: Request, res: Response): Promise<void> => {\n" +
"        try {\n" +
"            const results = await this.service.list();\n" +
"            res.status(200).json({ success: true, data: results });\n" +
"        } catch (error: any) {\n" +
"            res.status(500).json({ success: false, error: error.message });\n" +
"        }\n" +
"    };\n" +
"}\n";
    const p = path.join(BASE_DIR, 'controllers', config.module, config.fileName + '.controller.ts');
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, content);
}

function generateRoute(config) {
    const content = "import { Router } from 'express';\n" +
"import { " + config.entityName + "Controller } from '../../controllers/" + config.module + "/" + config.fileName + ".controller';\n" +
"\n" +
"const router = Router();\n" +
"const controller = new " + config.entityName + "Controller();\n" +
"\n" +
"router.get('/', controller.list);\n" +
"router.get('/:id', controller.getById);\n" +
"router.post('/', controller.create);\n" +
"router.put('/:id', controller.update);\n" +
"router.delete('/:id', controller.delete);\n" +
"\n" +
"export default router;\n";
    const p = path.join(BASE_DIR, 'routes', config.module, config.fileName + '.routes.ts');
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, content);
}

function run() {
    console.log('Iniciando generación de CRUDs...');
    for (const config of configs) {
        console.log("Generando " + config.entityName + " (" + config.module + ")...");
        try {
            generateInterfaceRepo(config);
            generateInterfaceService(config);
            generateRepo(config);
            generateService(config);
            generateController(config);
            generateRoute(config);
        } catch (e) {
            console.error("Error generando " + config.entityName + ": " + e.message);
        }
    }
    console.log('Generación completa.');
}

run();
