export type PlayerStatsAvgName = string | Record<string, string>;

export interface PlayerStatsAvg {
    name: PlayerStatsAvgName;
    team: string;
    pos: string;
    stats_avg: {
        red?: Record<string, number>;
        blue?: Record<string, number>;
        green?: Record<string, number>;
    };
    prefixes_avg: Record<string, number>;
    suffixes_avg: Record<string, number>;
    best_series_id_group: string;
    best_series_id_playoff: string;
}

export function getPlayerNames(name: PlayerStatsAvgName): string[] {
    if (typeof name === 'string') {
        return [name];
    }
    return Object.values(name);
}

export function getPlayerNameDisplay(name: PlayerStatsAvgName): string {
    return getPlayerNames(name).join(', ');
}