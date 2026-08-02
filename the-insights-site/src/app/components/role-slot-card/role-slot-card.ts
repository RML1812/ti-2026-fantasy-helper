import { Component, computed, inject, input } from '@angular/core';
import { DataService } from '../../services/data';
import { ScoreService } from '../../services/score';
import { RouterModule } from '@angular/router';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';
import { PlayerWithIcon } from '../player-with-icon/player-with-icon';

@Component({
    selector: 'app-role-slot-card',
    standalone: true,
    imports: [RouterModule, FormatDecimalPipe, PlayerWithIcon],
    templateUrl: './role-slot-card.html',
    styleUrl: './role-slot-card.css',
})
export class RoleSlotCard {
    data = inject(DataService);
    scoreService = inject(ScoreService);

    team = input.required<string>();
    pos = input.required<string>();

    slotId = computed(() => this.data.createRoleSlotId(this.team(), this.pos()));

    score = computed(() => this.scoreService.calculateRoleSlot(this.team(), this.pos()));

    seriesUrl = computed(() => {
        const seriesId = this.score().seriesId;
        return seriesId ? this.data.getSeriesUrl(seriesId) : '';
    });
}
