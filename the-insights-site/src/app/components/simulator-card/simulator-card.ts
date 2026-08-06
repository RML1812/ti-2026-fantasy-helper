import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { DataService } from '../../services/data';
import { SettingsService } from '../../services/settings';
import { ScoreService } from '../../services/score';
import { PlayerWithIcon } from '../player-with-icon/player-with-icon';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';
import { CustomSelect, SelectOption } from '../custom-select/custom-select';

export interface SimulatorSlot {
    group: 'red' | 'green' | 'blue';
    stat: string | null;
    multiplier: number;
}

@Component({
    selector: 'app-simulator-card',
    standalone: true,
    imports: [
        FormsModule,
        TitleCasePipe,
        RouterModule,
        PlayerWithIcon,
        FormatDecimalPipe,
        CustomSelect,
    ],
    templateUrl: './simulator-card.html',
    styleUrl: './simulator-card.css',
})
export class SimulatorCard {
    data = inject(DataService);
    settings = inject(SettingsService);
    scoreService = inject(ScoreService);

    role = input.required<(typeof this.data.roleName)[number]>();

    slots = signal<SimulatorSlot[]>([]);
    displayValues = signal<Record<number, string>>({});

    scoreSlots = computed(() =>
        this.slots()
            .filter(slot => slot.stat !== null)
            .map(slot => ({
                group: slot.group,
                stat: slot.stat!,
                multiplier: slot.multiplier,
            }))
    );

    constructor() {
        effect(() => {
            this.initializeSlots();
        });
    }

    initializeSlots() {
        const role = this.data.roles()[this.role()];

        if (!role) return;

        const combination = this.settings.formatMode() === 'GROUP' ? role.group : role.playoff;

        const newSlots: SimulatorSlot[] = combination.split('').map(letter => ({
            group: (letter === 'R'
                ? 'red'
                : letter === 'G'
                  ? 'green'
                  : 'blue') as SimulatorSlot['group'],
            stat: null,
            multiplier: 1,
        }));

        const displays: Record<number, string> = {};
        newSlots.forEach((_, i) => (displays[i] = '100'));

        this.slots.set(newSlots);
        this.displayValues.set(displays);
    }

    availableStats(index: number): SelectOption[] {
        const slots = this.slots();
        const current = slots[index];
        const selected = new Set(
            slots
                .filter((_, i) => i !== index)
                .map(slot => slot.stat)
                .filter(Boolean)
        );

        return Object.entries(this.data.stats())
            .filter(([key, stat]) => stat.group === current.group && !selected.has(key))
            .map(([key, stat]) => ({ value: key, label: stat.label }));
    }

    updateStat(index: number, stat: string | null) {
        this.slots.update(slots => {
            const copy = [...slots];
            copy[index] = {
                ...copy[index],
                stat,
            };

            return copy;
        });
    }

    updateMultiplier(index: number, raw: string) {
        this.displayValues.update(d => ({ ...d, [index]: raw }));

        if (raw === '' || raw === '-') return;

        const multiplier = Math.round(parseFloat(raw)) / 100;

        if (isNaN(multiplier)) return;

        this.slots.update(slots => {
            const copy = [...slots];
            copy[index] = {
                ...copy[index],
                multiplier,
            };

            return copy;
        });
    }

    calculateRoleSlotAverage(team: string, pos: string) {
        const avg = this.data.getPlayerStatsAvgByTeamAndRole(team, pos);

        if (!avg) return;

        return this.scoreService.calculateSimulator(avg.stats_avg, this.scoreSlots());
    }

    calculateRoleSlotBest(team: string, pos: string) {
        return this.scoreService.calculateBestPairForSimulator(team, pos, this.scoreSlots());
    }

    ranking = computed(() => {
        return this.data
            .getRoleSlotsByRole(this.role())
            .map(slot => {
                const score =
                    this.settings.statsMode() === 'AVG'
                        ? this.calculateRoleSlotAverage(slot.team, slot.pos)
                        : this.calculateRoleSlotBest(slot.team, slot.pos);

                return { slot, score };
            })
            .filter(row => row.score)
            .sort((a, b) => b.score!.total - a.score!.total)
            .slice(0, 10);
    });
}
