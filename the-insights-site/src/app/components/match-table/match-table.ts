import { Component, computed, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DataService } from '../../services/data';
import { ScoreService } from '../../services/score';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';
import { MatchStats } from '../../models/player-stats';

interface SeriesMatch {
    match: MatchStats;
    heroes: Map<string, string>;
    score: number;
}

interface SeriesRow {
    seriesId: string;
    matches: SeriesMatch[];
    score: number;
    seriesWon: boolean;
    playerNames: string[];
}

@Component({
    selector: 'app-match-table',
    standalone: true,
    imports: [RouterModule, FormatDecimalPipe],
    templateUrl: './match-table.html',
    styleUrl: './match-table.css',
})
export class MatchTable {
    data = inject(DataService);
    scoreService = inject(ScoreService);

    team = input.required<string>();
    pos = input.required<string>();

    slotId = computed(() => this.data.createRoleSlotId(this.team(), this.pos()));

    playerNames = computed(() => this.data.getRoleSlotPlayers(this.team(), this.pos()));

    rows = computed(() => {
        const playerList = this.playerNames();
        const allMatches = this.data.getPlayerMatchesForSlot(this.team(), this.pos());

        const seen = new Set<string>();
        const uniqueMatches: { playerName: string; match: MatchStats }[] = [];

        for (const entry of allMatches) {
            if (!seen.has(entry.match.match_id)) {
                seen.add(entry.match.match_id);
                uniqueMatches.push(entry);
            }
        }

        const grouped = new Map<string, { match: MatchStats; heroes: Map<string, string> }[]>();

        for (const { match } of uniqueMatches) {
            const heroes = new Map<string, string>();

            for (const playerName of playerList) {
                const playerEntry = allMatches.find(
                    e => e.playerName === playerName && e.match.match_id === match.match_id
                );
                if (playerEntry) {
                    heroes.set(playerName, playerEntry.match.hero);
                }
            }

            if (playerList.length > 1 && heroes.size < playerList.length) continue;

            const existing = grouped.get(match.series_id);
            if (existing) {
                existing.push({ match, heroes });
            } else {
                grouped.set(match.series_id, [{ match, heroes }]);
            }
        }

        const seriesRows: SeriesRow[] = [];

        for (const [seriesId, seriesMatches] of grouped) {
            if (seriesMatches.length < 2) continue;

            const scored = seriesMatches.map(sm => ({
                ...sm,
                score: this.scoreService.calculateStats(sm.match.stats, this.pos()).total,
            }));
            scored.sort((a, b) => b.score - a.score);
            const best2 = scored.slice(0, 2);
            const selectedMatchIds = best2.map(m => m.match.match_id);
            const selectedMatches = seriesMatches.filter(sm =>
                selectedMatchIds.includes(sm.match.match_id)
            );

            const source = this.scoreService.findSeriesBestMatches(seriesId);
            if (!source) continue;

            const scoreResult = this.scoreService.calculateStats(source.stats, this.pos());

            const winCount = selectedMatches.filter(sm => sm.match.won).length;
            const seriesWon = winCount > selectedMatches.length / 2;

            seriesRows.push({
                seriesId,
                matches: selectedMatches
                    .map(sm => ({
                        match: sm.match,
                        heroes: sm.heroes,
                        score: this.scoreService.calculateStats(sm.match.stats, this.pos()).total,
                    }))
                    .sort((a, b) => a.match.match_id.localeCompare(b.match.match_id)),
                score: scoreResult.total,
                seriesWon,
                playerNames: playerList,
            });
        }

        return seriesRows.sort((a, b) => b.score - a.score);
    });
}
