import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Hero } from '../models/hero';
import { Player } from '../models/player';
import { PlayerStats } from '../models/player-stats';
import { PlayerStatsAvg, getPlayerNames } from '../models/player-stats-avg';
import { Role } from '../models/role';
import { Stat } from '../models/stat';
import { Prefix } from '../models/prefix';
import { Suffix } from '../models/suffix';
import { TeamIcon } from '../models/team-icon';

export interface RoleSlot {
    team: string;
    pos: string;
    players: string[];
    statsAvg: PlayerStatsAvg;
}

@Injectable({
    providedIn: 'root',
})
export class DataService {
    http = inject(HttpClient);

    constructor() {
        this.loadAll();
    }

    players = signal<Player[]>([]);
    playerStats = signal<PlayerStats[]>([]);
    playerStatsAvg = signal<PlayerStatsAvg[]>([]);
    heroes = signal<Record<string, Hero>>({});
    stats = signal<Record<string, Stat>>({});
    prefixes = signal<Record<string, Prefix>>({});
    suffixes = signal<Record<string, Suffix>>({});
    roles = signal<Record<string, Role>>({});
    teamIcon = signal<TeamIcon[]>([]);

    roleName = ['Core', 'Mid', 'Support'];

    loadAll() {
        this.http
            .get<Player[]>('assets/data/players.json')
            .subscribe(data => this.players.set(data));

        this.http
            .get<PlayerStats[]>('assets/data/players_stats.json')
            .subscribe(data => this.playerStats.set(data));

        this.http
            .get<PlayerStatsAvg[]>('assets/data/players_stats_avg.json')
            .subscribe(data => this.playerStatsAvg.set(data));

        this.http
            .get<Record<string, Hero>>('assets/data/heroes.json')
            .subscribe(data => this.heroes.set(data));

        this.http
            .get<Record<string, Stat>>('assets/data/stats.json')
            .subscribe(data => this.stats.set(data));

        this.http
            .get<Record<string, Prefix>>('assets/data/prefixes.json')
            .subscribe(data => this.prefixes.set(data));

        this.http
            .get<Record<string, Suffix>>('assets/data/suffixes.json')
            .subscribe(data => this.suffixes.set(data));

        this.http
            .get<Record<string, Role>>('assets/data/roles.json')
            .subscribe(data => this.roles.set(data));

        this.http
            .get<TeamIcon[]>('assets/data/teams_icon.json')
            .subscribe(data => this.teamIcon.set(data));
    }

    createRoleSlotId(team: string, pos: string): string {
        return `${team}-${pos}`.replace(/\s+/g, '-');
    }

    parseRoleSlotId(slotId: string): { team: string; pos: string } | null {
        const lastDashIndex = slotId.lastIndexOf('-');
        if (lastDashIndex === -1) return null;

        const pos = slotId.substring(lastDashIndex + 1);
        if (!this.roleName.includes(pos)) return null;

        const team = slotId.substring(0, lastDashIndex).replace(/-/g, ' ');
        return { team, pos };
    }

    getPlayer(name: string) {
        return this.players().find(p => p.name === name);
    }

    getPlayerStats(name: string) {
        return this.playerStats().find(p => p.name === name);
    }

    getPlayerStatsAvg(name: string) {
        return this.playerStatsAvg().find(p => {
            const names = getPlayerNames(p.name);
            return names.includes(name);
        });
    }

    getPlayerStatsAvgByTeamAndRole(team: string, pos: string) {
        return this.playerStatsAvg().find(p => p.team === team && p.pos === pos);
    }

    getRoleSlotPlayers(team: string, pos: string): string[] {
        const avg = this.getPlayerStatsAvgByTeamAndRole(team, pos);
        if (!avg) return [];
        return getPlayerNames(avg.name);
    }

    getAllRoleSlots(): RoleSlot[] {
        return this.playerStatsAvg().map(avg => ({
            team: avg.team,
            pos: avg.pos,
            players: getPlayerNames(avg.name),
            statsAvg: avg,
        }));
    }

    getRoleSlotsByRole(pos: string): RoleSlot[] {
        return this.getAllRoleSlots().filter(slot => slot.pos === pos);
    }

    searchRoleSlots(query: string): RoleSlot[] {
        const q = query.toLowerCase().trim();
        if (!q) return [];

        return this.getAllRoleSlots().filter(
            slot =>
                slot.team.toLowerCase().includes(q) ||
                slot.pos.toLowerCase().includes(q) ||
                slot.players.some(name => name.toLowerCase().includes(q))
        );
    }

    getTeamIcon(team: string): string {
        const icon = this.teamIcon().find(t => t.team === team);
        return icon?.icon ?? '';
    }

    getHeroIcon(hero: string): string {
        return `https://dota2protracker.com/static/icons/${hero.replaceAll(' ', '_')}_minimap_icon.png`;
    }

    getMatchUrl(matchId: string): string {
        return `https://www.dotabuff.com/matches/${matchId}`;
    }

    getSeriesUrl(seriesId: string): string {
        return `https://www.dotabuff.com/esports/series/${seriesId}`;
    }

    getPrefixLabel(id: string): string {
        return this.prefixes()[id]?.label ?? id;
    }

    getSuffixLabel(id: string): string {
        return this.suffixes()[id]?.label ?? id;
    }

    getSeriesMatches(seriesId: string, playerName?: string) {
        const allMatches = this.playerStats();
        const matches: {
            playerName: string;
            match: NonNullable<PlayerStats['matches'][number]>;
        }[] = [];

        for (const playerStat of allMatches) {
            if (playerName && playerStat.name !== playerName) continue;

            for (const match of playerStat.matches) {
                if (match.series_id === seriesId) {
                    matches.push({ playerName: playerStat.name, match });
                }
            }
        }

        return matches;
    }

    getPlayerMatchesForSlot(
        team: string,
        pos: string
    ): { playerName: string; match: NonNullable<PlayerStats['matches'][number]> }[] {
        const players = this.getRoleSlotPlayers(team, pos);
        const allMatches = this.playerStats();
        const result: { playerName: string; match: NonNullable<PlayerStats['matches'][number]> }[] =
            [];

        for (const playerStat of allMatches) {
            if (!players.includes(playerStat.name)) continue;

            for (const match of playerStat.matches) {
                result.push({ playerName: playerStat.name, match });
            }
        }

        return result;
    }

    getSeriesMatchesForSlot(
        seriesId: string,
        team: string,
        pos: string
    ): { playerName: string; match: NonNullable<PlayerStats['matches'][number]> }[] {
        const players = this.getRoleSlotPlayers(team, pos);
        const allMatches = this.playerStats();
        const result: { playerName: string; match: NonNullable<PlayerStats['matches'][number]> }[] =
            [];

        for (const playerStat of allMatches) {
            if (!players.includes(playerStat.name)) continue;

            for (const match of playerStat.matches) {
                if (match.series_id === seriesId) {
                    result.push({ playerName: playerStat.name, match });
                }
            }
        }

        return result;
    }
}
