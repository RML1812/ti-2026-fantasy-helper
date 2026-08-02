import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { PlayerWithIcon } from '../../components/player-with-icon/player-with-icon';
import { SwitchMode } from '../../components/switch-mode/switch-mode';
import { DataService } from '../../services/data';
import { ScoreService } from '../../services/score';
import { SettingsService } from '../../services/settings';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';

@Component({
    selector: 'app-leaderboard',
    standalone: true,
    imports: [RouterModule, PlayerWithIcon, SwitchMode, FormatDecimalPipe],
    templateUrl: './leaderboard.html',
    styleUrl: './leaderboard.css',
})
export class Leaderboard implements OnInit {
    private meta = inject(Meta);
    private title = inject(Title);
    data = inject(DataService);
    scoreService = inject(ScoreService);
    settings = inject(SettingsService);

    ngOnInit(): void {
        this.title.setTitle('Leaderboard — The Insights');
        this.meta.updateTag({
            name: 'description',
            content:
                'Dota 2 TI 2026 fantasy leaderboard — player rankings by role and overall score.',
        });
        this.meta.updateTag({ property: 'og:title', content: 'Leaderboard — The Insights' });
        this.meta.updateTag({
            property: 'og:description',
            content:
                'Dota 2 TI 2026 fantasy leaderboard — player rankings by role and overall score.',
        });
    }

    selectedRole = signal<string>('ALL');

    roles = computed(() => ['ALL', ...this.data.roleName]);

    roleSlots = computed(() => {
        if (this.selectedRole() === 'ALL') {
            return this.data.getAllRoleSlots();
        }

        return this.data.getRoleSlotsByRole(this.selectedRole());
    });

    ranking = computed(() => {
        return this.roleSlots()
            .map(slot => ({
                slot,
                score: this.scoreService.calculateRoleSlot(slot.team, slot.pos),
            }))
            .sort((a, b) => b.score.total - a.score.total);
    });
}
