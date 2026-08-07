export interface H2HRecord {
    win: number;
    lose: number;
}

export interface TeamRating {
    team: string;
    glicko_2: number;
    h2h: Record<string, H2HRecord>;
}