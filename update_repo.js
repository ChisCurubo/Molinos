const fs = require('fs');
let code = fs.readFileSync('d:/CursoJava/Programacion/Molinos/MolinosBack/Molinos/src/repositories/db_triggers/trigger_logic.repository.ts', 'utf8');

code = code.replace(/import \{ PoolConnection, ResultSetHeader \} from 'mysql2\/promise';/, "import { PoolConnection, ResultSetHeader, Pool } from 'mysql2/promise';");

code = code.replace(/export class TriggerLogicRepositoryImpl implements TriggerLogicRepository \{/, "export class TriggerLogicRepositoryImpl implements TriggerLogicRepository {\n\n  constructor(private db: Pool) {}\n\n  private getConn(tx?: PoolConnection): PoolConnection | Pool {\n    return tx || this.db;\n  }");

code = code.replace(/async afterInsertMPE\(tx: PoolConnection, newRow: any\): Promise<void> \{/, "async afterInsertMPE(newRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/async afterUpdateMPE\(tx: PoolConnection, oldRow: any, newRow: any\): Promise<void> \{/, "async afterUpdateMPE(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/async afterInsertProcesamiento\(tx: PoolConnection, newRow: any\): Promise<void> \{/, "async afterInsertProcesamiento(newRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/async beforeUpdateConcentradoCierre\(tx: PoolConnection, oldRow: any, newRow: any\): Promise<void> \{/, "async beforeUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/async afterUpdateConcentradoCierre\(tx: PoolConnection, oldRow: any, newRow: any\): Promise<void> \{/, "async afterUpdateConcentradoCierre(oldRow: any, newRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/async beforeInsertViajeMaterial\(tx: PoolConnection, newRow: any\): Promise<void> \{/, "async beforeInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/async afterInsertViajeMaterial\(tx: PoolConnection, newRow: any\): Promise<void> \{/, "async afterInsertViajeMaterial(newRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/async afterDeleteViajeMaterial\(tx: PoolConnection, oldRow: any\): Promise<void> \{/, "async afterDeleteViajeMaterial(oldRow: any, tx?: PoolConnection): Promise<void> {\n    const conn = this.getConn(tx);");

code = code.replace(/await tx\.execute/g, "await conn.execute");

fs.writeFileSync('d:/CursoJava/Programacion/Molinos/MolinosBack/Molinos/src/repositories/db_triggers/trigger_logic.repository.ts', code);
console.log("Done");
