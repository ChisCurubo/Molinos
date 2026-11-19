import path from 'path';
import { Client } from 'minio';
import { CONFIG } from '../config';
import { IFileStorage } from '../../ports/archivos/file_storage.interface';
import { MinioStorage } from '../../repositories/archivos/minio.storage';
import { LocalStorage } from '../../repositories/archivos/local.storage';
import { ArchivoService } from '../../services/archivos/archivo.service';
import { ArchivoController } from '../../controllers/archivos/archivo.controller';

export class ArchivosFactory {
    private controller?: ArchivoController;
    private service?: ArchivoService;

    getArchivoService(): ArchivoService {
        if (!this.service) {
            // Driver por modo (STORAGE_DRIVER manda): oracle = MinIO; local = carpeta en disco.
            let storage: IFileStorage;
            if (CONFIG.storageDriver === 'minio') {
                const client = new Client({
                    endPoint: CONFIG.minioEndpoint, port: CONFIG.minioPort, useSSL: CONFIG.minioSSL,
                    accessKey: CONFIG.minioAccessKey, secretKey: CONFIG.minioSecretKey,
                });
                const minio = new MinioStorage(client, CONFIG.minioBucket);
                minio.iniciar();
                storage = minio;
            } else {
                storage = new LocalStorage(path.resolve(process.cwd(), CONFIG.storageDir));
            }
            this.service = new ArchivoService(storage, '/api/v1/archivos');
        }
        return this.service;
    }

    getArchivoController(): ArchivoController {
        return (this.controller ??= new ArchivoController(this.getArchivoService()));
    }
}
