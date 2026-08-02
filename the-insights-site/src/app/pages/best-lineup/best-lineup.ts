import { Component, computed, inject, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SwitchMode } from '../../components/switch-mode/switch-mode';
import { DataService, RoleSlot } from '../../services/data';
import { ScoreService } from '../../services/score';
import { SettingsService } from '../../services/settings';
import { RoleSlotCard } from '../../components/role-slot-card/role-slot-card';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';

interface RankedSlot {
    slot: RoleSlot;
    score: {
        total: number;
        seriesId?: string;
        matchIds?: string[];
        stats: {
            key: string;
            label: string;
            group: 'red' | 'green' | 'blue';
            value: number;
            score: number;
        }[];
    };
}

@Component({
    selector: 'app-best-lineup',
    standalone: true,
    imports: [RoleSlotCard, SwitchMode, FormatDecimalPipe],
    templateUrl: './best-lineup.html',
    styleUrl: './best-lineup.css',
})
export class BestLineup implements OnInit {
    private meta = inject(Meta);
    private title = inject(Title);
    data = inject(DataService);
    scoreService = inject(ScoreService);
    settings = inject(SettingsService);

    ngOnInit(): void {
        this.title.setTitle('Best Lineup — The Insights');
        this.meta.updateTag({
            name: 'description',
            content:
                'See the best possible Dota 2 TI 2026 fantasy lineup based on pro player performance data and hero pools.',
        });
        this.meta.updateTag({ property: 'og:title', content: 'Best Lineup — The Insights' });
        this.meta.updateTag({
            property: 'og:description',
            content:
                'See the best possible Dota 2 TI 2026 fantasy lineup based on pro player performance data and hero pools.',
        });
    }

    roleRanking = computed(() => {
        const result: Record<string, RankedSlot[]> = {
            Core: [],
            Mid: [],
            Support: [],
        };

        for (const role of this.data.roleName) {
            const slots = this.data.getRoleSlotsByRole(role);

            result[role] = slots
                .map(slot => ({
                    slot,
                    score: this.scoreService.calculateRoleSlot(slot.team, slot.pos),
                }))
                .sort((a, b) => b.score.total - a.score.total);
        }
        return result;
    });

    bestLineup = computed(() => {
        const core = this.roleRanking()['Core'][0];
        const mid = this.roleRanking()['Mid'][0];
        const support = this.roleRanking()['Support'][0];

        return {
            core,
            mid,
            support,
            total: (core?.score.total ?? 0) + (mid?.score.total ?? 0) + (support?.score.total ?? 0),
        };
    });
}
