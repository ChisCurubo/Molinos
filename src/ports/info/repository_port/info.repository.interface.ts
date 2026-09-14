export interface IInfoRepository {
    estadisticas(): Promise<any>;
    health(): Promise<{ db: boolean; uptime: number }>;
}
