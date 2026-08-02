import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerWithIcon } from '../player-with-icon/player-with-icon';
import { DataService } from '../../services/data';

@Component({
    selector: 'app-player-search',
    standalone: true,
    imports: [FormsModule, PlayerWithIcon],
    templateUrl: './player-search.html',
    styleUrl: './player-search.css',
})
export class PlayerSearch {
    router = inject(Router);
    data = inject(DataService);
    query = signal('');

    filteredRoleSlots = computed(() => {
        const q = this.query().trim().toLowerCase();
        if (!q) {
            return [];
        }

        return this.data.searchRoleSlots(q);
    });

    openRoleSlot(team: string, pos: string) {
        const slotId = this.data.createRoleSlotId(team, pos);
        this.router.navigate(['/in-depth-role', slotId]);
        this.query.set('');
    }
}
