# AGENTS.md

## Stack
- Angular 21 standalone components (no NgModules)
- Angular signals for state (`signal()`, `computed()`, `input()`, `input.required()`)
- Tailwind CSS v4 via `@tailwindcss/postcss` (imported in `src/styles.css`, not yet used in components)
- Component-scoped CSS via `.css` files
- TypeScript strict mode enabled (`strict: true`, `strictTemplates: true`)

## Commands
- Dev server: `ng serve` (port 4200)
- Lint: `ng lint`
- Build: `ng build`
- Test: `ng test` (Vitest via `@angular/build:unit-test`; no test files exist yet)

## Conventions
- Selectors: `app-*` prefix, kebab-case filenames
- Prettier: 4-space indent, 100 char width, single quotes, trailing commas (es5), `arrowParens: "avoid"`, `bracketSameLine: true`
- ESLint: Angular component selector prefix `app`, kebab-case; directive selector prefix `app`, camelCase
- Angular 21 control flow: `@if`, `@for`, `@else`
- Signals: `signal()`, `computed()`, `input()`, `input.required()`
- Use `inject()` function (NOT constructor injection) for DI
- External templates (`templateUrl`) and styles (`styleUrl`) — never inline
- Class names: PascalCase without "Component" suffix (e.g., `Sidebar`, `HeroPool`)
- `@angular/core` imports: sorted alphabetically
- `ScoreService` injection: always named `scoreService`
- `@angular/router`: use `RouterModule` import when template uses `routerLink`; use individual `RouterLink`, `RouterLinkActive` imports when only those directives are needed
- Badge CSS: `.badge.red`, `.badge.green`, `.badge.blue` with `margin-right` and `margin-bottom` — duplicated in 3 component CSS files
- Z-index: use CSS variables (`--z-dropdown: 10`, `--z-sticky: 20`, `--z-modal: 40`, `--z-tooltip: 100`) — never hardcoded
- All data is static JSON loaded via HTTP at startup — no backend API

## Architecture Notes

### Data Flow
- `DataService` loads ALL JSON data on construction via HTTP (9 requests on app boot)
- All data stored in signals: `players`, `playerStats`, `playerStatsAvg`, `heroes`, `stats`, `prefixes`, `suffixes`, `roles`, `teamIcon`
- `ScoreService` uses `DataService` + `SettingsService` to calculate scores
- `SettingsService` holds global mode: `statsMode` (AVG/BEST), `formatMode` (GROUP/PLAYOFF), `customSeriesId`
- `DataService.roleName` = `['Core', 'Mid', 'Support']` — use this instead of defining local role arrays

### Role Slot Model (Core Business Logic)
- Route: `/in-depth-role/:name` where name is `{team}-{pos}` (e.g., `Iron-Wing-Core`)
- Query param: `?series=` to filter to a specific series
- Role slots are team+position combinations (e.g., "Core" for "Iron Wing")
- Each slot can have multiple players (teammates sharing the same role)
- `DataService` methods: `createRoleSlotId`, `parseRoleSlotId`, `getRoleSlotPlayers`, `getAllRoleSlots`, `getRoleSlotsByRole`, `searchRoleSlots`

### Scoring System
- Roles define color patterns (e.g., Core=GROUP: "RGR", PLAYOFF: "RGRGR")
- Each letter (R/G/B) represents a stat slot from a color group
- For each slot, picks the highest-weighted unused stat from that color group
- Final score = sum of all selected stat scores × their weights
- Stat groups defined in `src/assets/data/stats.json`
- **Deaths stat is inverted**: `1950 - (value * weight)` instead of `value * weight` (1950 = 10 deaths × 195 weight)
- BEST mode: aggregates 2 best matches from a series (averages their stats)

### Component Patterns
- All components are standalone — no NgModules
- Template syntax: `@if`, `@for`, `@else` (NOT `*ngIf`, `*ngFor`)
- `@for` requires `track` expressions (e.g., `track hero.hero`, `track $index`)
- Use `input()` and `input.required()` for component inputs (NOT `@Input` decorator)

### CSS Patterns
- All component CSS files contain content — use existing styles as reference
- Common patterns: `:host { display: block; animation: fadeInUp 0.5s ease-out both; }`, multi-layer gradient backgrounds, gold accent borders
- Responsive breakpoints: `@media (max-width: 768px)`
- All clickable links: no underline, just color change on hover (matches global `a:hover` pattern)

### Data Structure
- `players_stats_avg.json`: Groups players by team+role; `name` field can be string (single player) or object with numeric keys (multiple players)
- Use `getPlayerNames()` and `getPlayerNameDisplay()` helper functions from `player-stats-avg.ts` to handle mixed name types
- `players_stats.json`: Individual player match data with `series_id` field for grouping matches into series
- `prefixes.json` / `suffixes.json`: Replace former `titles.json` / `subtitles.json`

### External Links
- Hero icons: `https://dota2protracker.com/static/icons/{hero}_minimap_icon.png`
- Match history: `https://www.dotabuff.com/matches/{match_id}`
- Series history: `https://www.dotabuff.com/esports/series/{series_id}`

### Deployment
- GitHub Pages via `.github/workflows/deploy.yml` (Node 20, `ng build --configuration production`, `actions/deploy-pages@v4`)
- `baseHref: "/ti-2026-fantasy-helper/"` in `angular.json` production config
- `robots.txt` and `sitemap.xml` in `public/` directory

### Potential Issues
- `players_stats_avg.json` `name` field is typed as `Record<string, string>` but used as string lookup — may cause runtime failures
- No tests exist — verify changes manually with `ng serve`
