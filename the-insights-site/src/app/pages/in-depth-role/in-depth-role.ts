import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { SwitchMode } from '../../components/switch-mode/switch-mode';
import { RoleSlotCard } from '../../components/role-slot-card/role-slot-card';
import { HeroPool } from '../../components/hero-pool/hero-pool';
import { PrefixStats } from '../../components/prefix-stats/prefix-stats';
import { SuffixStats } from '../../components/suffix-stats/suffix-stats';
import { MatchTable } from '../../components/match-table/match-table';
import { PlayerWithIcon } from '../../components/player-with-icon/player-with-icon';
import { DataService } from '../../services/data';
import { SettingsService } from '../../services/settings';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
    selector: 'app-in-depth-role',
    standalone: true,
    imports: [
        RouterModule,
        RoleSlotCard,
        HeroPool,
        PrefixStats,
        SuffixStats,
        MatchTable,
        SwitchMode,
        PlayerWithIcon,
    ],
    templateUrl: './in-depth-role.html',
    styleUrl: './in-depth-role.css',
})
export class InDepthRole implements OnInit, OnDestroy {
    private meta = inject(Meta);
    private title = inject(Title);
    data = inject(DataService);
    settings = inject(SettingsService);
    router = inject(Router);

    ngOnInit(): void {
        this.title.setTitle('In-Depth Role — The Insights');
        this.meta.updateTag({
            name: 'description',
            content:
                'Deep dive into player performance by role — hero pools, match history, stats, and fantasy scores for TI 2026.',
        });
        this.meta.updateTag({ property: 'og:title', content: 'In-Depth Role — The Insights' });
        this.meta.updateTag({
            property: 'og:description',
            content:
                'Deep dive into player performance by role — hero pools, match history, stats, and fantasy scores for TI 2026.',
        });
    }

    ngOnDestroy(): void {
        this.settings.clearCustomSeries();
    }

    route = inject(ActivatedRoute);

    routeName = toSignal(this.route.paramMap.pipe(map(params => params.get('name'))), {
        initialValue: null,
    });

    searchQuery = signal('');

    searchResults = computed(() => {
        const query = this.searchQuery();
        if (!query) return [];
        return this.data.searchRoleSlots(query);
    });

    updateSeriesQuery(seriesId: string | null) {
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                series: seriesId,
            },
            queryParamsHandling: 'merge',
        });
    }

    constructor() {
        this.route.queryParamMap.subscribe(params => {
            const seriesId = params.get('series');
            if (!seriesId) {
                this.settings.clearCustomSeries();
                return;
            }
            this.settings.setCustomSeries(seriesId);

            setTimeout(() => {
                document
                    .getElementById('role-slot-card')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    parsedRoute = computed(() => {
        const name = this.routeName();
        if (!name) return null;
        return this.data.parseRoleSlotId(name);
    });

    team = computed(() => this.parsedRoute()?.team ?? '');
    pos = computed(() => this.parsedRoute()?.pos ?? '');

    slotId = computed(() => this.data.createRoleSlotId(this.team(), this.pos()));

    isValid = computed(() => this.team() !== '' && this.pos() !== '');

    players = computed(() => this.data.getRoleSlotPlayers(this.team(), this.pos()));

    teamIcon = computed(() => this.data.getTeamIcon(this.team()));

    player1Matches = computed(() => {
        if (this.players().length === 0) return [];
        const playerStats = this.data.getPlayerStats(this.players()[0]);
        return playerStats?.matches ?? [];
    });

    player2Matches = computed(() => {
        if (this.players().length < 2) return [];
        const playerStats = this.data.getPlayerStats(this.players()[1]);
        return playerStats?.matches ?? [];
    });

    matchesPlayedTogether = computed(() => {
        const p1 = this.player1Matches();
        const p2 = this.player2Matches();

        if (p1.length === 0 && p2.length === 0) return 0;
        if (p2.length === 0) return p1.length;
        if (p1.length === 0) return p2.length;

        const p2Ids = new Set(p2.map(m => m.match_id));
        return p1.filter(m => p2Ids.has(m.match_id)).length;
    });

    player1StatsAvg = computed(() => {
        const avg = this.data.getPlayerStatsAvgByTeamAndRole(this.team(), this.pos());
        if (!avg) return { prefixes: {}, suffixes: {} };
        return {
            prefixes: avg.prefixes_avg,
            suffixes: avg.suffixes_avg,
        };
    });
}
