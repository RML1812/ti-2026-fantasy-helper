export interface PredictedSwissMatch {
    team1: string;
    team2: string;
    winner: string;
    score: string;
    probability: number;
}

export interface PredictedSwissRound {
    round: number;
    matches: PredictedSwissMatch[];
}

export interface PredictedSwissOutcome {
    finished: boolean;
    history: PredictedSwissRound[];
    qualified: { team: string }[];
    eliminated: { team: string }[];
}

export interface PredictedSwiss {
    groups: Record<string, { teams: string[] }>;
    outcomes: PredictedSwissOutcome[];
}