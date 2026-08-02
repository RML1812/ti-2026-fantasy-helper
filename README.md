# The Insights — TI 2026 Fantasy Helper

> Pick the best Fantasy for The International 2026, based on history — not assumption.

[![Live site](https://img.shields.io/badge/Live%20Site-RML1812.github.io/ti-2026-fantasy-helper-brightgreen.svg)](https://RML1812.github.io/ti-2026-fantasy-helper/)
[![Angular](https://img.shields.io/badge/Angular-21-E01C37.svg)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-strict-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-deployed-informational.svg)](https://github.com/RML1812/ti-2026-fantasy-helper)

**The Insights** is a fantasy-helper for **The International 2026**. It uses pro-scene competitive data from **patch 7.41** to guide who to pick in the fantasy compendium event — helping you choose reasonable players based on history, not names — so even casual players who don't follow the Dota 2 pro scene can score higher points.

Check it out live at **[RML1812.github.io/ti-2026-fantasy-helper](https://RML1812.github.io/ti-2026-fantasy-helper/)**.

---

## What the site offers

### Best Lineup
See the single **best core + mid + support lineup** the data recommends, with the projected total score.
- Toggle between **AVG** (average stats) and **BEST** (top matches of a series)
- Switch between **GROUP** and **PLAYOFF** format modes
- Inspect each recommended slot with a full card

### In-Depth Role
Search for any **team, role, or player** and dive deep into a single team+position slot.
- Full score breakdown per role slot
- **Hero pools** for the players in the slot
- **Prefix / suffix** stat frequency per series
- Matches-played-together counter and full **match history**

### Simulator
Build your **custom fantasy lineup** yourself — one card per role (core / mid / support) — and instantly see the projected score you'd get.

### Leaderboard
Rank every team+role slot in the pool by fantasy points.
- Filter by **All Roles / Core / Mid / Support**
- Color-coded stat badges showing how each score breaks down
- In **BEST** mode, jump straight to the exact series behind each score

### TI Prophecy
Predict what each team's placement will be. *(Coming soon.)*

---

## Tech stack

| What | Tech |
| ----- | ---- |
| Framework | Angular 21 (standalone components, signals) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + component CSS |
| Hosting | GitHub Pages |

---

## Getting started

```bash
# install dependencies
npm install

# dev server -> http://localhost:4200
ng serve

# production build
ng build

# unit tests & lint
npm test
ng lint
```

---

## Repository structure

```
Dota 2 Fantasy 2026/
├── the-insights-site/   # this project — the Angular 21 frontend
│   └── src/assets/data/ # static JSON payloads consumed by the app
└── data-gathering/      # Python scrapers that produce the data
                         # (see data-gathering/README.md)
```

---

## Data sources & credits

Player and match statistics are collected from public Dota 2 sources covering the pro scene on **patch 7.41** — Liquipedia, Dotabuff, and the OpenDota / STRATZ APIs.

The biggest thanks to [**bydoodle/dota2fantasy**](https://github.com/bydoodle/dota2fantasy) — this project gained tons of knowledge and reference from it.

---