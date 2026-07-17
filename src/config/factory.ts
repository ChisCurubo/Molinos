import { Pool } from 'mysql2/promise';
import Database from './database.config';

import { AuthFactory } from './factories/auth.factory';
import { InfoFactory } from './factories/info.factory';
import { NominaFactory } from './factories/nomina.factory';
import { PagosFactory } from './factories/pagos.factory';
import { MaterialFactory } from './factories/material.factory';
import { CacheService } from '../services/cache/cache.service';

class AppFactory {
    private db: Pool;

    // Singleton instance
    private static instance: AppFactory;

    // Sub-factories
    public auth: AuthFactory;
    public info: InfoFactory;
    public nomina: NominaFactory;
    public pagos: PagosFactory;
    public material: MaterialFactory;

    private constructor() {
        this.db = Database.getInstance();
        this.auth = new AuthFactory(this.db);
        this.info = new InfoFactory(this.db);
        this.nomina = new NominaFactory(this.db);
        this.pagos = new PagosFactory(this.db);
        this.material = new MaterialFactory(this.db);
    }

    public static getInstance(): AppFactory {
        if (!AppFactory.instance) {
            AppFactory.instance = new AppFactory();
        }
        return AppFactory.instance;
    }

    public async init(): Promise<void> {
        // Inicializamos los servicios globales que requieran BD (como el Caché)
        await CacheService.getInstance().init(
            this.material.getMinaRepo(),
            this.material.getMineroRepo(),
            this.material.getZonaRepo(),
            this.material.getDuenoVolquetaRepo()
        );
    }
}

export const factory = AppFactory.getInstance();
