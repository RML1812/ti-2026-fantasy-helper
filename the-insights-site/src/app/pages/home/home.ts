import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './home.html',
    styleUrl: './home.css',
})
export class Home implements OnInit {
    private meta = inject(Meta);
    private title = inject(Title);

    showBanner = signal(true);

    dismissBanner(): void {
        this.showBanner.set(false);
    }

    ngOnInit(): void {
        this.title.setTitle('The Insights — Dota 2 TI 2026 Fantasy Helper');
        this.meta.updateTag({
            name: 'description',
            content:
                'Dota 2 TI 2026 Fantasy Helper — Pick the best lineup based on pro player stats, hero pools, and competitive history. Data-driven fantasy decisions.',
        });
        this.meta.updateTag({
            property: 'og:title',
            content: 'The Insights — Dota 2 TI 2026 Fantasy Helper',
        });
        this.meta.updateTag({
            property: 'og:description',
            content:
                'Pick the best lineup based on pro player stats, hero pools, and competitive history. Data-driven fantasy decisions.',
        });
    }
}
