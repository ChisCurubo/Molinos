export interface IInfoService {
    estadisticas(): Promise<any>;
    health(): Promise<{ db: boolean; uptime: number }>;
}
