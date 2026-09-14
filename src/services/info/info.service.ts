import { IInfoRepository } from '../../ports/info/repository_port/info.repository.interface';
import { IInfoService } from '../../ports/info/service_port/info.service.interface';

export class InfoService implements IInfoService {
    constructor(private repo: IInfoRepository) {}

    async estadisticas(): Promise<any> {
        return this.repo.estadisticas();
    }

    async health(): Promise<{ db: boolean; uptime: number }> {
        return this.repo.health();
    }
}
