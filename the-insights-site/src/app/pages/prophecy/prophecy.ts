import { Component, inject, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Component({
    selector: 'app-prophecy',
    standalone: true,
    imports: [],
    templateUrl: './prophecy.html',
    styleUrl: './prophecy.css',
})
export class Prophecy implements OnInit {
    private meta = inject(Meta);
    private title = inject(Title);

    ngOnInit(): void {
        this.title.setTitle('TI Prophecy — The Insights');
        this.meta.updateTag({
            name: 'description',
            content:
                'Predict team placements for TI 2026 — see projections based on competitive performance data.',
        });
        this.meta.updateTag({ property: 'og:title', content: 'TI Prophecy — The Insights' });
        this.meta.updateTag({
            property: 'og:description',
            content:
                'Predict team placements for TI 2026 — see projections based on competitive performance data.',
        });
    }
}
