import { Injectable, signal } from '@angular/core';

export type StatsMode = 'AVG' | 'BEST';
export type CustomSeriesId = string | null;
export type FormatMode = 'GROUP' | 'PLAYOFF';

@Injectable({
    providedIn: 'root',
})
export class SettingsService {
    statsMode = signal<StatsMode>('AVG');
    formatMode = signal<FormatMode>('GROUP');
    customSeriesId = signal<CustomSeriesId>(null);

    setStatsMode(mode: StatsMode) {
        this.statsMode.set(mode);
        this.customSeriesId.set(null);
    }

    setFormatMode(mode: FormatMode) {
        this.formatMode.set(mode);
    }

    setCustomSeries(seriesId: CustomSeriesId) {
        this.customSeriesId.set(seriesId);
    }

    clearCustomSeries() {
        this.customSeriesId.set(null);
    }
}
