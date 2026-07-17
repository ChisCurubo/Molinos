import { Pool } from 'mysql2/promise';
import { InfoRepository } from '../../repositories/info/info.repository';
import { InfoController } from '../../controllers/info/info.controller';

export class InfoFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private infoRepository?: InfoRepository;
    private infoController?: InfoController;

    public getInfoRepository(): InfoRepository {
        if (!this.infoRepository) {
            this.infoRepository = new InfoRepository(this.db);
        }
        return this.infoRepository;
    }

    public getInfoController(): InfoController {
        if (!this.infoController) {
            this.infoController = new InfoController(this.getInfoRepository());
        }
        return this.infoController;
    }
    
    // ==========================================
}
