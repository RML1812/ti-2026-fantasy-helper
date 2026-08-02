import { Component, computed, inject, input } from '@angular/core';
import { DataService } from '../../services/data';
import { FormatDecimalPipe } from '../../pipes/format-decimal.pipe';

@Component({
    selector: 'app-suffix-stats',
    standalone: true,
    imports: [FormatDecimalPipe],
    templateUrl: './suffix-stats.html',
    styleUrl: './suffix-stats.css',
})
export class SuffixStats {
    data = inject(DataService);

    suffixesAvg = input.required<Record<string, boolean | number>>();

    suffixCards = computed(() => {
        return Object.entries(this.suffixesAvg())
            .map(([id, percentage]) => ({
                id,
                percentage: Number(percentage),
            }))
            .sort((a, b) => b.percentage - a.percentage);
    });
}
