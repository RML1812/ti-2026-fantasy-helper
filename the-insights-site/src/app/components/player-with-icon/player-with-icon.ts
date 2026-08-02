import { Component, computed, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DataService } from '../../services/data';

@Component({
    selector: 'app-player-with-icon',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './player-with-icon.html',
    styleUrl: './player-with-icon.css',
})
export class PlayerWithIcon {
    data = inject(DataService);

    team = input.required<string>();
    pos = input.required<string>();

    slotId = computed(() => this.data.createRoleSlotId(this.team(), this.pos()));

    players = computed(() => this.data.getRoleSlotPlayers(this.team(), this.pos()));

    teamIcon = computed(() => this.data.getTeamIcon(this.team()));

    playersDisplay = computed(() => this.players().join(' & '));
}
