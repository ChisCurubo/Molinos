import { Pool } from 'mysql2/promise';
import { InfoRepository } from '../../repositories/info/info.repository';
import { InfoService } from '../../services/info/info.service';
import { InfoController } from '../../controllers/info/info.controller';

export class InfoFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private infoRepository?: InfoRepository;
    private infoService?: InfoService;
    private infoController?: InfoController;

    public getInfoRepository(): InfoRepository {
        if (!this.infoRepository) {
            this.infoRepository = new InfoRepository(this.db);
        }
        return this.infoRepository;
    }

    public getInfoService(): InfoService {
        if (!this.infoService) {
            this.infoService = new InfoService(this.getInfoRepository());
        }
        return this.infoService;
    }

    public getInfoController(): InfoController {
        if (!this.infoController) {
            this.infoController = new InfoController(this.getInfoService());
        }
        return this.infoController;
    }

    // ==========================================
}
