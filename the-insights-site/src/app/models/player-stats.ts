export interface MatchData {
    red?: Record<string, number>;
    blue?: Record<string, number>;
    green?: Record<string, number>;
}

export interface MatchStats {
    match_id: string;
    series_id: string;
    won: boolean;
    hero: string;
    stats: MatchData;
    prefixes?: Record<string, boolean>;
    suffixes?: Record<string, boolean | number>;
}

export interface PlayerStats {
    name: string;
    matches: MatchStats[];
}