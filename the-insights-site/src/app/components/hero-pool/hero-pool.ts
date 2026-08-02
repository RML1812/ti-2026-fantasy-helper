import { Component, computed, inject, input } from '@angular/core';
import { DataService } from '../../services/data';
import { MatchStats } from '../../models/player-stats';

interface HeroStats {
    hero: string;
    wins: number;
    losses: number;
    games: number;
}

@Component({
    selector: 'app-hero-pool',
    standalone: true,
    imports: [],
    templateUrl: './hero-pool.html',
    styleUrl: './hero-pool.css',
})
export class HeroPool {
    data = inject(DataService);

    matches = input.required<MatchStats[]>();
    player2Matches = input<MatchStats[]>([]);
    playerName = input<string>('');
    player2Name = input<string>('');

    heroes = computed(() => this.calculateHeroes(this.matches()));
    player2Heroes = computed(() => this.calculateHeroes(this.player2Matches()));

    hasSecondPlayer = computed(() => this.player2Matches().length > 0 && this.player2Name());

    calculateHeroes(matches: MatchStats[]): HeroStats[] {
        const pool = new Map<string, HeroStats>();

        for (const match of matches) {
            const hero = match.hero;
            if (!pool.has(hero)) {
                pool.set(hero, {
                    hero,
                    wins: 0,
                    losses: 0,
                    games: 0,
                });
            }

            const h = pool.get(hero)!;
            h.games++;

            if (match.won) {
                h.wins++;
            } else {
                h.losses++;
            }
        }

        return [...pool.values()].sort((a, b) => {
            if (b.games !== a.games) {
                return b.games - a.games;
            }
            return b.wins - a.wins;
        });
    }
}
