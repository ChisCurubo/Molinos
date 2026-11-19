import { Readable } from 'stream';

/** Puerto de almacenamiento de archivos: el dominio no sabe si detrás hay MinIO, S3 o disco. */
export interface IFileStorage {
    put(key: string, data: Buffer, contentType: string): Promise<void>;
    get(key: string): Promise<{ stream: Readable; contentType: string; size: number } | null>;
    remove(key: string): Promise<void>;
    /** Salud del almacenamiento (para /health). Nunca lanza. */
    estado(): Promise<{ driver: 'minio' | 'disco'; ok: boolean; detalle?: string }>;
}

export interface IArchivoService {
    /** Valida (tipo real y tamaño), guarda con nombre generado y devuelve la URL a guardar en *_url. */
    subir(data: Buffer, carpeta?: string): Promise<{ url: string; key: string; tipo: string; tamano: number }>;
    obtener(key: string): ReturnType<IFileStorage['get']>;
    eliminar(key: string): Promise<void>;
    estado: IFileStorage['estado'];
}
