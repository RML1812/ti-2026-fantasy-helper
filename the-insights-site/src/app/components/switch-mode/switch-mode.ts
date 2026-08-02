import { Component, computed, inject } from '@angular/core';
import { SettingsService } from '../../services/settings';

@Component({
    selector: 'app-switch-mode',
    standalone: true,
    imports: [],
    templateUrl: './switch-mode.html',
    styleUrl: './switch-mode.css',
})
export class SwitchMode {
    settings = inject(SettingsService);

    statsMode = computed(() => this.settings.statsMode());
    formatMode = computed(() => this.settings.formatMode());
    isCustom = computed(() => !!this.settings.customSeriesId());

    setStatsMode(mode: 'AVG' | 'BEST') {
        this.settings.setStatsMode(mode);
    }

    setFormatMode(mode: 'GROUP' | 'PLAYOFF') {
        this.settings.setFormatMode(mode);
    }
}
