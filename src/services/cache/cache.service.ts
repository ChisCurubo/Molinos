import { IMinaRepository, IMineroRepository, IZonaRepository } from '../../ports/material/repository_port/mina.repository.interface';
import { IDuenoVolquetaRepository } from '../../ports/material/repository_port/volqueta.repository.interface';

export class CacheService {
    private static instance: CacheService;
    
    private minas: Map<number, any> = new Map();
    private mineros: Map<number, any> = new Map();
    private zonas: Map<number, any> = new Map();
    private duenosVolqueta: Map<number, any> = new Map();

    private isLoaded = false;

    private constructor() {}

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    public async init(
        minaRepo: IMinaRepository,
        mineroRepo: IMineroRepository,
        zonaRepo: IZonaRepository,
        duenoRepo: IDuenoVolquetaRepository
    ): Promise<void> {
        console.log('[Cache] Iniciando carga de catálogos en memoria...');
        try {
            const minasRows = await minaRepo.list();
            minasRows.forEach((row: any) => this.minas.set(row.id, row));

            const minerosRows = await mineroRepo.list();
            minerosRows.forEach((row: any) => this.mineros.set(row.id, row));

            const zonasRows = await zonaRepo.list();
            zonasRows.forEach((row: any) => this.zonas.set(row.id, row));

            const duenosRows = await duenoRepo.list();
            duenosRows.forEach((row: any) => this.duenosVolqueta.set(row.id, row));

            this.isLoaded = true;
            console.log(`[Cache] Catálogos cargados exitosamente. Minas: ${this.minas.size}, Mineros: ${this.mineros.size}, Zonas: ${this.zonas.size}, Dueños: ${this.duenosVolqueta.size}`);
        } catch (error) {
            console.error('[Cache] Error al cargar los catálogos en memoria:', error);
            throw error;
        }
    }

    // --- GETTERS ---
    public getMinas(): any[] { return Array.from(this.minas.values()); }
    public getMineros(): any[] { return Array.from(this.mineros.values()); }
    public getZonas(): any[] { return Array.from(this.zonas.values()); }
    public getDuenosVolqueta(): any[] { return Array.from(this.duenosVolqueta.values()); }

    public getCatalogos() {
        return {
            minas: this.getMinas(),
            mineros: this.getMineros(),
            zonas: this.getZonas(),
            duenos_volqueta: this.getDuenosVolqueta()
        };
    }

    // --- SETTERS / UPDATERS ---
    public addMina(mina: any): void {
        this.minas.set(mina.id, mina);
    }
    public updateMina(mina: any): void {
        if (this.minas.has(mina.id)) {
            this.minas.set(mina.id, { ...this.minas.get(mina.id), ...mina });
        }
    }
    public deleteMina(id: number): void {
        this.minas.delete(id);
    }

    public addMinero(minero: any): void {
        this.mineros.set(minero.id, minero);
    }
    public updateMinero(minero: any): void {
        if (this.mineros.has(minero.id)) {
            this.mineros.set(minero.id, { ...this.mineros.get(minero.id), ...minero });
        }
    }
    public deleteMinero(id: number): void {
        this.mineros.delete(id);
    }

    public addZona(zona: any): void {
        this.zonas.set(zona.id, zona);
    }
    public updateZona(zona: any): void {
        if (this.zonas.has(zona.id)) {
            this.zonas.set(zona.id, { ...this.zonas.get(zona.id), ...zona });
        }
    }
    public deleteZona(id: number): void {
        this.zonas.delete(id);
    }

    public addDueno(dueno: any): void {
        this.duenosVolqueta.set(dueno.id, dueno);
    }
    public updateDueno(dueno: any): void {
        if (this.duenosVolqueta.has(dueno.id)) {
            this.duenosVolqueta.set(dueno.id, { ...this.duenosVolqueta.get(dueno.id), ...dueno });
        }
    }
    public deleteDueno(id: number): void {
        this.duenosVolqueta.delete(id);
    }
}
