import { randomUUID } from 'crypto';
import { IArchivoService, IFileStorage } from '../../ports/archivos/file_storage.interface';
import { AppError } from '../../errors/app-error';

/** Error del cliente (tipo/tamaño): se rechaza. Cualquier otro error de subida es de infraestructura. */
export class ArchivoInvalido extends AppError {
    constructor(message: string) { super('FILE_INVALID', message); this.name = 'ArchivoInvalido'; Object.setPrototypeOf(this, ArchivoInvalido.prototype); }
}

export const MAX_BYTES = 15 * 1024 * 1024;
/** Carpetas permitidas en la key (primer segmento). La key se guarda en la BD, nunca una URL. */
export const CARPETAS = ['comprobantes', 'soportes', 'fotos'];
const RE_KEY = new RegExp(`^(${CARPETAS.join('|')})/\\d{4}/\\d{2}/[0-9a-f-]{36}\\.(pdf|png|jpg|webp)$`);

// Se detecta el tipo por los primeros bytes: el Content-Type que manda el cliente se puede falsificar.
const TIPOS: { ext: string; mime: string; magic: number[]; tras?: { en: number; bytes: number[] } }[] = [
    { ext: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
    { ext: 'png', mime: 'image/png',       magic: [0x89, 0x50, 0x4e, 0x47] },
    { ext: 'jpg', mime: 'image/jpeg',      magic: [0xff, 0xd8, 0xff] },
    { ext: 'webp', mime: 'image/webp',     magic: [0x52, 0x49, 0x46, 0x46], tras: { en: 8, bytes: [0x57, 0x45, 0x42, 0x50] } }, // RIFF....WEBP
];

export class ArchivoService implements IArchivoService {
    constructor(private storage: IFileStorage, private urlBase: string) {}

    async subir(data: Buffer, carpeta = 'comprobantes') {
        if (!CARPETAS.includes(carpeta)) throw new ArchivoInvalido(`Carpeta no permitida (use: ${CARPETAS.join(', ')})`);
        if (!data?.length) throw new ArchivoInvalido('Archivo vacío');
        if (data.length > MAX_BYTES) throw new ArchivoInvalido('El archivo supera 15 MB');
        const tipo = TIPOS.find(t => t.magic.every((b, i) => data[i] === b) && (!t.tras || t.tras.bytes.every((b, i) => data[t.tras!.en + i] === b)));
        if (!tipo) throw new ArchivoInvalido('Solo se permiten archivos PDF, PNG, JPG o WebP');

        const d = new Date();
        const key = `${carpeta}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${tipo.ext}`;
        await this.storage.put(key, data, tipo.mime);
        return { url: `${this.urlBase}/${key}`, key, tipo: tipo.mime, tamano: data.length };
    }

    eliminar(key: string) {
        if (!RE_KEY.test(key)) throw new ArchivoInvalido('Clave de archivo inválida');
        return this.storage.remove(key);
    }

    obtener(key: string) {
        if (!RE_KEY.test(key)) return Promise.resolve(null);
        return this.storage.get(key);
    }

    estado() { return this.storage.estado(); }
}
