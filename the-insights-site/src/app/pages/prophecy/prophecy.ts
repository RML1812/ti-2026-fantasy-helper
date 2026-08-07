import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DataService } from '../../services/data';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';

interface RoundResult {
    win: boolean;
    text: string;
}

interface StandingsRow {
    team: string;
    group: string;
    wins: number;
    losses: number;
    gamesWin: number;
    gamesLoss: number;
    roundResults: (RoundResult | null)[];
    status: 'qualified' | 'eliminated';
    oppMatchesWon: number;
    oppGamesPct: number;
}

interface FlowMatch {
    team1: string;
    team2: string;
    score: string;
    winner: string;
    prob1: number;
    prob2: number;
}

interface MatchBucket {
    record: string;
    matches: FlowMatch[];
}

interface RoundBuckets {
    round: number;
    buckets: MatchBucket[];
}

interface H2HRow {
    team: string;
    cells: ({ win: number; lose: number } | null)[];
}

@Component({
    selector: 'app-prophecy',
    standalone: true,
    imports: [FormatDecimalPipe],
    templateUrl: './prophecy.html',
    styleUrl: './prophecy.css',
})
export class Prophecy implements OnInit {
    private meta = inject(Meta);
    private title = inject(Title);
    data = inject(DataService);

    ngOnInit(): void {
        this.title.setTitle('TI Prophecy — The Insights');
        this.meta.updateTag({
            name: 'description',
            content:
                'Predict team placements for TI 2026 — see projections based on competitive performance data.',
        });
        this.meta.updateTag({ property: 'og:title', content: 'TI Prophecy — The Insights' });
        this.meta.updateTag({
            property: 'og:description',
            content:
                'Predict team placements for TI 2026 — see projections based on competitive performance data.',
        });
    }

    activeTab = signal<'SWISS' | 'PLAYOFF'>('SWISS');

    outcome = computed(() => this.data.predictedSwiss()?.outcomes[0] ?? null);

    rounds = computed(() => this.outcome()?.history ?? []);

    groupOf = (team: string): string => {
        const groups = this.data.predictedSwiss()?.groups ?? {};
        for (const [letter, group] of Object.entries(groups)) {
            if (group.teams.includes(team)) return letter;
        }
        return '';
    };

    pctOf = (value: number): string => `${(value * 100).toFixed(1)}%`;

    recordBeforeRound(roundIndex: number, team: string): string {
        let wins = 0;
        let losses = 0;
        for (let r = 0; r < roundIndex; r++) {
            for (const match of this.rounds()[r].matches) {
                if (match.team1 !== team && match.team2 !== team) continue;
                if (match.winner === team) wins += 1;
                else losses += 1;
            }
        }
        return `${wins}-${losses}`;
    }

    standingsRows = computed<StandingsRow[]>(() => {
        const qualified = new Set((this.outcome()?.qualified ?? []).map(t => t.team));
        const eliminated = new Set((this.outcome()?.eliminated ?? []).map(t => t.team));
        const teams = qualified.size
            ? [...new Set([...qualified, ...eliminated])]
            : this.data.teamsRating().map(r => r.team);

        const record: Record<
            string,
            { wins: number; losses: number; gamesWin: number; gamesLoss: number }
        > = {};
        for (const team of teams) {
            record[team] = { wins: 0, losses: 0, gamesWin: 0, gamesLoss: 0 };
        }
        for (const round of this.rounds()) {
            for (const match of round.matches) {
                const [a, b] = match.score.split('-').map(Number);
                if (match.winner === match.team1) {
                    record[match.team1].wins += 1;
                    record[match.team2].losses += 1;
                } else {
                    record[match.team2].wins += 1;
                    record[match.team1].losses += 1;
                }
                record[match.team1].gamesWin += a;
                record[match.team1].gamesLoss += b;
                record[match.team2].gamesWin += b;
                record[match.team2].gamesLoss += a;
            }
        }

        const opponents: Record<string, Set<string>> = {};
        for (const team of teams) {
            opponents[team] = new Set();
        }
        for (const round of this.rounds()) {
            for (const match of round.matches) {
                opponents[match.team1].add(match.team2);
                opponents[match.team2].add(match.team1);
            }
        }

        const rows: StandingsRow[] = teams.map(team => {
            const rec = record[team];
            const roundResults: (RoundResult | null)[] = [];

            for (const round of this.rounds()) {
                const match = round.matches.find(m => m.team1 === team || m.team2 === team);
                if (!match) {
                    roundResults.push(null);
                    continue;
                }

                const teamWon = match.winner === team;
                const teamGames = team === match.team1 ? Number(match.score.split('-')[0]) : Number(match.score.split('-')[1]);
                const oppGames = team === match.team1 ? Number(match.score.split('-')[1]) : Number(match.score.split('-')[0]);
                roundResults.push({
                    win: teamWon,
                    text: `${teamGames}:${oppGames}`,
                });
            }

            return {
                team,
                group: this.groupOf(team),
                wins: rec.wins,
                losses: rec.losses,
                gamesWin: rec.gamesWin,
                gamesLoss: rec.gamesLoss,
                roundResults,
                status: qualified.has(team) ? 'qualified' : 'eliminated',
                oppMatchesWon: [...opponents[team]].reduce(
                    (sum, opp) => sum + record[opp].wins,
                    0
                ),
                oppGamesPct:
                    [...opponents[team]].reduce((sum, opp) => {
                        const total = record[opp].gamesWin + record[opp].gamesLoss;
                        return total ? sum + record[opp].gamesWin / total : sum;
                    }, 0) / Math.max(opponents[team].size, 1),
            };
        });

        return rows.sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (a.losses !== b.losses) return a.losses - b.losses;
            const gamePct = (r: StandingsRow) => {
                const total = r.gamesWin + r.gamesLoss;
                return total ? r.gamesWin / total : 0;
            };
            if (gamePct(b) !== gamePct(a)) return gamePct(b) - gamePct(a);
            if (b.oppMatchesWon !== a.oppMatchesWon) return b.oppMatchesWon - a.oppMatchesWon;
            if (b.oppGamesPct !== a.oppGamesPct) return b.oppGamesPct - a.oppGamesPct;
            return a.team.localeCompare(b.team);
        });
    });

    roundsBuckets = computed<RoundBuckets[]>(() =>
        this.rounds().map((round, ri) => {
            const buckets = new Map<string, FlowMatch[]>();
            for (const match of round.matches) {
                const record = this.recordBeforeRound(ri, match.team1);
                const bucket = buckets.get(record) ?? [];
                bucket.push({
                    team1: match.team1,
                    team2: match.team2,
                    score: match.score,
                    winner: match.winner,
                    prob1: match.probability,
                    prob2: 1 - match.probability,
                });
                buckets.set(record, bucket);
            }
            return {
                round: round.round,
                buckets: [...buckets.entries()]
                    .map(([record, matches]) => ({ record, matches }))
                    .sort((x, y) => {
                        const xWin = Number(x.record.split('-')[0]);
                        const yWin = Number(y.record.split('-')[0]);
                        return yWin - xWin;
                    }),
            };
        })
    );

    glickoRanking = computed(() =>
        [...this.data.teamsRating()].sort((a, b) => b.glicko_2 - a.glicko_2)
    );

    h2hMatrix = computed<H2HRow[]>(() => {
        const teams = this.glickoRanking().map(r => r.team);
        return teams.map(rowTeam => {
            const row = this.data.teamsRating().find(r => r.team === rowTeam);
            return {
                team: rowTeam,
                cells: teams.map(colTeam => {
                    if (rowTeam === colTeam) return null;
                    return row?.h2h?.[colTeam] ?? { win: 0, lose: 0 };
                }),
            };
        });
    });
}