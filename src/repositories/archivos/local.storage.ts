import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { IFileStorage } from '../../ports/archivos/file_storage.interface';

/**
 * Almacenamiento en disco para modo local (MinIO no existe en la PC de desarrollo). Carpeta: STORAGE_DIR.
 * shortcut: sin metadatos ni réplica; el tipo se deduce de la extensión.
 */
const MIME: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

export class LocalStorage implements IFileStorage {
    constructor(private root: string) {}

    // Protege contra `..`, rutas absolutas y bytes nulos: el resultado siempre queda DENTRO de la carpeta raíz.
    private full(key: string) {
        const f = path.resolve(this.root, ...key.split('/'));
        if (key.includes('\0') || !(f + path.sep).startsWith(path.resolve(this.root) + path.sep)) throw new Error('Clave de archivo inválida');
        return f;
    }

    async estado(): Promise<{ driver: 'disco'; ok: boolean; detalle?: string }> {
        try { await fs.promises.mkdir(this.root, { recursive: true }); await fs.promises.access(this.root, fs.constants.W_OK); return { driver: 'disco', ok: true }; }
        catch (e: any) { return { driver: 'disco', ok: false, detalle: e.code ?? 'sin acceso a la carpeta' }; }
    }

    async put(key: string, data: Buffer): Promise<void> {
        const f = this.full(key);
        await fs.promises.mkdir(path.dirname(f), { recursive: true });
        await fs.promises.writeFile(f, data);
    }

    async get(key: string): Promise<{ stream: Readable; contentType: string; size: number } | null> {
        const f = this.full(key);
        try {
            const st = await fs.promises.stat(f);
            return { stream: fs.createReadStream(f), contentType: MIME[path.extname(f)] ?? 'application/octet-stream', size: st.size };
        } catch { return null; }
    }

    async remove(key: string): Promise<void> {
        await fs.promises.rm(this.full(key), { force: true });
    }
}
