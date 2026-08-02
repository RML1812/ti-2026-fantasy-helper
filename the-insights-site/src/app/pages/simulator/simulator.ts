import { Component, inject, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SettingsService } from '../../services/settings';
import { SimulatorCard } from '../../components/simulator-card/simulator-card';
import { SwitchMode } from '../../components/switch-mode/switch-mode';

@Component({
    selector: 'app-simulator',
    standalone: true,
    imports: [SimulatorCard, SwitchMode],
    templateUrl: './simulator.html',
    styleUrl: './simulator.css',
})
export class Simulator implements OnInit {
    private meta = inject(Meta);
    private title = inject(Title);
    settings = inject(SettingsService);

    ngOnInit(): void {
        this.title.setTitle('Simulator — The Insights');
        this.meta.updateTag({
            name: 'description',
            content:
                'Simulate your Dota 2 TI 2026 fantasy lineup and see projected scores based on player stats.',
        });
        this.meta.updateTag({ property: 'og:title', content: 'Simulator — The Insights' });
        this.meta.updateTag({
            property: 'og:description',
            content:
                'Simulate your Dota 2 TI 2026 fantasy lineup and see projected scores based on player stats.',
        });
    }
}
