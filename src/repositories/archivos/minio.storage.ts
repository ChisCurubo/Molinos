import { Client } from 'minio';
import { Readable } from 'stream';
import { IFileStorage } from '../../ports/archivos/file_storage.interface';

export class MinioStorage implements IFileStorage {
    private ready?: Promise<void>;

    constructor(private client: Client, private bucket: string) {}

    // El bucket se crea una vez, la primera vez que se usa. Es privado: se sirve solo a través de la API.
    private ensureBucket(): Promise<void> {
        this.ready ??= this.client.bucketExists(this.bucket).then(async ok => {
            if (!ok) await this.client.makeBucket(this.bucket);
        }).catch(e => { this.ready = undefined; throw e; });
        return this.ready;
    }

    /** Crea el bucket al arrancar. Si MinIO no responde solo se avisa: la API sigue viva y reintenta al primer uso. */
    iniciar(): void {
        this.ensureBucket().then(() => console.log(`[Archivos] MinIO listo: bucket "${this.bucket}" (privado)`))
            .catch(e => console.error(`[Archivos] MinIO no responde (${e.code ?? e.message}); la API sigue y reintenta al primer uso`));
    }

    async estado(): Promise<{ driver: 'minio'; ok: boolean; detalle?: string }> {
        try { await this.ensureBucket(); return { driver: 'minio', ok: true }; }
        catch (e: any) { return { driver: 'minio', ok: false, detalle: e.code ?? 'sin conexión' }; }
    }

    async put(key: string, data: Buffer, contentType: string): Promise<void> {
        await this.ensureBucket();
        await this.client.putObject(this.bucket, key, data, data.length, { 'Content-Type': contentType });
    }

    async get(key: string): Promise<{ stream: Readable; contentType: string; size: number } | null> {
        await this.ensureBucket();
        try {
            const stat = await this.client.statObject(this.bucket, key);
            const stream = await this.client.getObject(this.bucket, key);
            return { stream, contentType: stat.metaData['content-type'] || 'application/octet-stream', size: stat.size };
        } catch (e: any) {
            if (e.code === 'NotFound' || e.code === 'NoSuchKey') return null;
            throw e;
        }
    }

    async remove(key: string): Promise<void> {
        await this.client.removeObject(this.bucket, key);
    }
}
