export interface ScoreStat {
    key: string;
    label: string;
    group: 'red' | 'green' | 'blue';
    value: number;
    score: number;
}

export interface ScoreResult {
    seriesId?: string;
    matchIds?: string[];
    total: number;
    stats: ScoreStat[];
}