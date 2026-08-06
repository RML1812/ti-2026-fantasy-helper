import { Injectable, inject } from '@angular/core';
import { DataService } from './data';
import { SettingsService } from './settings';
import { Player } from '../models/player';
import { MatchData } from '../models/player-stats';
import { getPlayerNames } from '../models/player-stats-avg';

interface ScoreStat {
    key: string;
    label: string;
    group: 'red' | 'green' | 'blue';
    value: number;
    score: number;
}

interface ScoreResult {
    seriesId?: string;
    matchIds?: string[];
    total: number;
    stats: ScoreStat[];
    source: 'AVG' | 'BEST' | 'CUSTOM';
}

interface ScoreSlot {
    group: 'red' | 'green' | 'blue';
    stat: string;
    multiplier: number;
}

interface PlayerStatsSource {
    seriesId?: string;
    matchIds?: string[];
    stats: MatchData;
}

@Injectable({
    providedIn: 'root',
})
export class ScoreService {
    data = inject(DataService);
    settings = inject(SettingsService);

    generatePairs<T>(arr: T[]): T[][] {
        const pairs: T[][] = [];
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                pairs.push([arr[i], arr[j]]);
            }
        }
        return pairs;
    }

    getPlayer(name: string): Player | undefined {
        return this.data.players().find(p => p.name === name);
    }

    getCombination(role: string): string {
        const roleData = this.data.roles()[role];
        return this.settings.formatMode() === 'GROUP' ? roleData.group : roleData.playoff;
    }

    findMatch(name: string, matchId: string): PlayerStatsSource | undefined {
        const player = this.data.playerStats().find(p => p.name === name);

        if (!player) return;

        const match = player.matches.find(m => m.match_id === matchId);

        if (!match || !match.stats) return;

        return {
            matchIds: [matchId],
            stats: match.stats,
        };
    }

    findSeriesBestMatches(seriesId: string, playerName?: string): PlayerStatsSource | undefined {
        const matches = this.data.getSeriesMatches(seriesId, playerName);

        if (matches.length < 2) {
            if (matches.length === 1) {
                return {
                    seriesId,
                    matchIds: [matches[0].match.match_id],
                    stats: matches[0].match.stats,
                };
            }
            return undefined;
        }

        const scored = matches.map(({ match }) => ({
            match,
            score: this.calculateMatchScore(match.stats),
        }));

        scored.sort((a, b) => b.score - a.score);

        const best2 = scored.slice(0, 2);

        const aggregated = this.averageStats(best2.map(m => m.match.stats));

        return {
            seriesId,
            matchIds: best2.map(m => m.match.match_id),
            stats: aggregated,
        };
    }

    findSeriesBestMatchesForSlot(
        seriesId: string,
        team: string,
        pos: string
    ): PlayerStatsSource | undefined {
        const matches = this.data.getSeriesMatchesForSlot(seriesId, team, pos);

        if (matches.length === 0) return undefined;

        const expectedCount = this.data.getRoleSlotPlayers(team, pos).length;

        const byMatch = new Map<string, { stats: MatchData[]; won: boolean }>();
        for (const { match } of matches) {
            const existing = byMatch.get(match.match_id);
            if (existing) {
                existing.stats.push(match.stats);
            } else {
                byMatch.set(match.match_id, { stats: [match.stats], won: match.won });
            }
        }

        const uniqueMatches: { matchId: string; stats: MatchData }[] = [];
        for (const [matchId, entry] of byMatch) {
            if (entry.stats.length < expectedCount) continue;
            if (entry.stats.length > 1) {
                const wonSet = new Set(
                    matches.filter(m => m.match.match_id === matchId).map(m => m.match.won)
                );
                if (wonSet.size > 1) continue;
            }
            const combined =
                entry.stats.length === 1 ? entry.stats[0] : this.averageStats(entry.stats);
            uniqueMatches.push({ matchId, stats: combined });
        }

        if (uniqueMatches.length < 2) {
            if (uniqueMatches.length === 1) {
                return {
                    seriesId,
                    matchIds: [uniqueMatches[0].matchId],
                    stats: uniqueMatches[0].stats,
                };
            }
            return undefined;
        }

        const pairs = this.generatePairs(uniqueMatches);

        let bestPair: { matchIds: string[]; stats: MatchData; score: number } | undefined;

        for (const [a, b] of pairs) {
            const averaged = this.averageStats([a.stats, b.stats]);
            const scoreResult = this.calculateStats(averaged, pos);

            if (!bestPair || scoreResult.total > bestPair.score) {
                bestPair = {
                    matchIds: [a.matchId, b.matchId],
                    stats: averaged,
                    score: scoreResult.total,
                };
            }
        }

        if (!bestPair) return undefined;

        return {
            seriesId,
            matchIds: bestPair.matchIds,
            stats: bestPair.stats,
        };
    }

    calculateMatchScore(stats: MatchData): number {
        let total = 0;

        for (const group of ['red', 'green', 'blue'] as const) {
            const source = stats[group];
            if (!source) continue;

            for (const [key, value] of Object.entries(source)) {
                const stat = this.data.stats()[key];
                if (stat) {
                    total += this.computeStatScore(key, value);
                }
            }
        }

        return total;
    }

    calculateBestPairForSimulator(
        team: string,
        pos: string,
        scoreSlots: ScoreSlot[]
    ): ScoreResult | undefined {
        const matches = this.data.getPlayerMatchesForSlot(team, pos);

        if (matches.length === 0) return undefined;

        const expectedCount = this.data.getRoleSlotPlayers(team, pos).length;

        const bySeriesAndMatch = new Map<
            string,
            Map<string, { stats: MatchData[]; won: boolean }>
        >();
        for (const entry of matches) {
            const seriesId = entry.match.series_id;
            let byMatch = bySeriesAndMatch.get(seriesId);
            if (!byMatch) {
                byMatch = new Map();
                bySeriesAndMatch.set(seriesId, byMatch);
            }
            const existing = byMatch.get(entry.match.match_id);
            if (existing) {
                existing.stats.push(entry.match.stats);
            } else {
                byMatch.set(entry.match.match_id, {
                    stats: [entry.match.stats],
                    won: entry.match.won,
                });
            }
        }

        let bestResult: ScoreResult | undefined;

        for (const [, byMatch] of bySeriesAndMatch) {
            const uniqueMatches: { matchId: string; seriesId: string; stats: MatchData }[] = [];
            for (const [matchId, entry] of byMatch) {
                if (entry.stats.length < expectedCount) continue;
                if (entry.stats.length > 1) {
                    const wonSet = new Set(
                        matches.filter(m => m.match.match_id === matchId).map(m => m.match.won)
                    );
                    if (wonSet.size > 1) continue;
                }
                const combined =
                    entry.stats.length === 1 ? entry.stats[0] : this.averageStats(entry.stats);
                const firstEntry = matches.find(e => e.match.match_id === matchId)!;
                uniqueMatches.push({
                    matchId,
                    seriesId: firstEntry.match.series_id,
                    stats: combined,
                });
            }

            if (uniqueMatches.length === 0) continue;

            if (uniqueMatches.length === 1) {
                const m = uniqueMatches[0];
                const scoreResult = this.scoreMatch(m.stats, scoreSlots);
                scoreResult.matchIds = [m.matchId];
                scoreResult.seriesId = m.seriesId;
                if (!bestResult || scoreResult.total > bestResult.total) {
                    bestResult = scoreResult;
                }
                continue;
            }

            const pairs = this.generatePairs(uniqueMatches);

            for (const [a, b] of pairs) {
                const averaged = this.averageStats([a.stats, b.stats]);
                const scoreResult = this.scoreMatch(averaged, scoreSlots);

                scoreResult.matchIds = [a.matchId, b.matchId];
                scoreResult.seriesId = a.seriesId;

                if (!bestResult || scoreResult.total > bestResult.total) {
                    bestResult = scoreResult;
                }
            }
        }

        return bestResult;
    }

    averageStats(statsArray: MatchData[]): MatchData {
        const result: MatchData = {};
        const count = statsArray.length;

        if (count === 0) return result;

        for (const group of ['red', 'green', 'blue'] as const) {
            const groupResult: Record<string, number> = {};
            let hasValues = false;

            for (const stats of statsArray) {
                const source = stats[group];
                if (!source) continue;

                for (const [key, value] of Object.entries(source)) {
                    if (!groupResult[key]) {
                        groupResult[key] = 0;
                    }
                    groupResult[key] += value;
                    hasValues = true;
                }
            }

            if (hasValues) {
                for (const key of Object.keys(groupResult)) {
                    groupResult[key] /= count;
                }
                result[group] = groupResult;
            }
        }

        return result;
    }

    getStats(name: string): PlayerStatsSource | undefined {
        const avg = this.data.playerStatsAvg().find(p => {
            const names = getPlayerNames(p.name);
            return names.includes(name);
        });

        if (!avg) return;

        if (this.settings.customSeriesId()) {
            const seriesId = this.settings.customSeriesId();

            if (!seriesId) return;

            return this.findSeriesBestMatches(seriesId, name);
        } else {
            switch (this.settings.statsMode()) {
                case 'AVG':
                    return {
                        stats: avg.stats_avg,
                    };

                case 'BEST': {
                    const seriesId =
                        this.settings.formatMode() === 'GROUP'
                            ? avg.best_series_id_group
                            : avg.best_series_id_playoff;

                    return this.findSeriesBestMatches(seriesId, name);
                }
            }
        }
    }

    getRoleSlotStats(team: string, pos: string): PlayerStatsSource | undefined {
        const avg = this.data.getPlayerStatsAvgByTeamAndRole(team, pos);

        if (!avg) return;

        if (this.settings.customSeriesId()) {
            const seriesId = this.settings.customSeriesId();

            if (!seriesId) return;

            return this.findSeriesBestMatchesForSlot(seriesId, team, pos);
        } else {
            switch (this.settings.statsMode()) {
                case 'AVG':
                    return {
                        stats: avg.stats_avg,
                    };

                case 'BEST': {
                    const seriesId =
                        this.settings.formatMode() === 'GROUP'
                            ? avg.best_series_id_group
                            : avg.best_series_id_playoff;

                    return this.findSeriesBestMatchesForSlot(seriesId, team, pos);
                }
            }
        }
    }

    scoreStat(key: string, value: number): ScoreStat {
        const stat = this.data.stats()[key];

        return {
            key,
            label: stat.label,
            group: stat.group,
            value,
            score: this.computeStatScore(key, value),
        };
    }

    computeStatScore(key: string, value: number): number {
        const stat = this.data.stats()[key];
        if (key === 'deaths') {
            return 1950 - value * stat.weight;
        }
        return value * stat.weight;
    }

    calculateStats(stats: MatchData, role: string): ScoreResult {
        const result: ScoreResult = {
            total: 0,
            stats: [],
            source: 'AVG',
        };
        const combination = this.getCombination(role);
        const used = new Set<string>();

        for (const group of combination) {
            let source: Record<string, number> | undefined;
            switch (group) {
                case 'R':
                    source = stats.red;
                    break;

                case 'G':
                    source = stats.green;
                    break;

                case 'B':
                    source = stats.blue;
                    break;
            }

            if (!source) continue;

            let bestKey: string | undefined;
            let bestScore = -Infinity;

            for (const [key, value] of Object.entries(source)) {
                if (used.has(key)) continue;

                const score = this.computeStatScore(key, value);

                if (score > bestScore) {
                    bestScore = score;
                    bestKey = key;
                }
            }

            if (!bestKey) continue;

            used.add(bestKey);
            const stat = this.scoreStat(bestKey, source[bestKey]);

            result.stats.push(stat);
            result.total += stat.score;
        }

        return result;
    }

    calculateRoleSlot(team: string, pos: string): ScoreResult {
        const source = this.getRoleSlotStats(team, pos);

        if (!source) {
            return {
                total: 0,
                stats: [],
                source: 'AVG',
            };
        }

        const result = this.calculateStats(source.stats, pos);

        result.seriesId = source.seriesId;
        result.matchIds = source.matchIds;

        if (this.settings.customSeriesId()) {
            result.source = 'CUSTOM';
        } else {
            result.source = this.settings.statsMode();
        }

        return result;
    }

    calculate(name: string): ScoreResult {
        const player = this.getPlayer(name);
        if (!player) {
            return {
                total: 0,
                stats: [],
                source: 'AVG',
            };
        }

        const source = this.getStats(name);

        if (!source) {
            return {
                total: 0,
                stats: [],
                source: 'AVG',
            };
        }

        const result = this.calculateStats(source.stats, player.pos);

        result.seriesId = source.seriesId;
        result.matchIds = source.matchIds;

        if (this.settings.customSeriesId()) {
            result.source = 'CUSTOM';
        } else {
            result.source = this.settings.statsMode();
        }

        return result;
    }

    scoreMatch(stats: MatchData, slots: ScoreSlot[]): ScoreResult {
        const result: ScoreResult = {
            total: 0,
            stats: [],
            source: 'AVG',
        };

        for (const slot of slots) {
            let source: Record<string, number> | undefined;
            switch (slot.group) {
                case 'red':
                    source = stats.red;
                    break;

                case 'green':
                    source = stats.green;
                    break;

                case 'blue':
                    source = stats.blue;
                    break;
            }

            if (!source) continue;

            const value = source[slot.stat];

            if (value == null) continue;

            const meta = this.data.stats()[slot.stat];
            const score = this.computeStatScore(slot.stat, value) * slot.multiplier;

            result.stats.push({
                key: slot.stat,
                label: meta.label,
                group: meta.group,
                value,
                score,
            });

            result.total += score;
        }

        return result;
    }

    calculateSimulator(stats: MatchData, slots: ScoreSlot[]): ScoreResult {
        return this.scoreMatch(stats, slots);
    }
}
