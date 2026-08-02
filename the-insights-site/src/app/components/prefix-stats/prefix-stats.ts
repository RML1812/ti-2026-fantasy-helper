import { Component, computed, inject, input } from '@angular/core';
import { DataService } from '../../services/data';
import { MatchStats } from '../../models/player-stats';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';

interface PrefixCard {
    id: string;
    percentage: number;
    heroes: { hero: string; count: number }[];
}

@Component({
    selector: 'app-prefix-stats',
    standalone: true,
    imports: [FormatDecimalPipe],
    templateUrl: './prefix-stats.html',
    styleUrl: './prefix-stats.css',
})
export class PrefixStats {
    data = inject(DataService);

    matches = input.required<MatchStats[]>();
    player2Matches = input<MatchStats[]>([]);
    playerName = input<string>('');
    player2Name = input<string>('');

    matchCount = computed(() => this.matches().length);
    player2MatchCount = computed(() => this.player2Matches().length);

    prefixCards = computed(() => this.calculatePrefixCards(this.matches()));
    player2PrefixCards = computed(() => this.calculatePrefixCards(this.player2Matches()));

    hasSecondPlayer = computed(() => this.player2Matches().length > 0 && this.player2Name());

    calculatePrefixCards(matches: MatchStats[]): PrefixCard[] {
        const totalMatches = matches.length;
        const cards = new Map<
            string,
            {
                id: string;
                count: number;
                heroes: Map<string, number>;
            }
        >();

        for (const match of matches) {
            if (!match.prefixes) continue;

            for (const [prefix, value] of Object.entries(match.prefixes)) {
                if (!value) continue;

                if (!cards.has(prefix)) {
                    cards.set(prefix, {
                        id: prefix,
                        count: 0,
                        heroes: new Map(),
                    });
                }

                const card = cards.get(prefix)!;
                card.count++;
                card.heroes.set(match.hero, (card.heroes.get(match.hero) ?? 0) + 1);
            }
        }

        return [...cards.values()]
            .map(card => ({
                id: card.id,
                percentage: totalMatches > 0 ? card.count / totalMatches : 0,
                heroes: [...card.heroes.entries()]
                    .map(([hero, count]) => ({
                        hero,
                        count,
                    }))
                    .sort((a, b) => b.count - a.count),
            }))
            .sort((a, b) => b.percentage - a.percentage);
    }
}
