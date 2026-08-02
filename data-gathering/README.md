# TI 2026 Fantasy — Data Gathering

Python toolchain that compiles pro-scene match data for **The International 2026** into the static JSON files consumed by the insights site.

## What it does

Every script in this folder is one step of a pipeline that turns publicly available match data (Liquipedia, Dotabuff, OpenDota, STRATZ) into ready-to-use fantasy statistics for patch 7.41. The produced files are dropped into `the-insights-site/src/assets/data/`.

## The pipeline

| Step | Script | What it does | Produces |
| --- | --- | --- | --- |
| 1 | `players_scraper.py` | Pulls the TI 2026 roster from Liquipedia with team, role, and DatDota player id | `players.json` |
| 2 | `match_id_scraper.py` | Scrapes each player's patch 7.41 match history from Dotabuff (paginated, resumable) | `players_stats.json` (ids + results) |
| 3 | `stats_parser.py` | Fetches every match from OpenDota + STRATZ and parses per-player stats: color-grouped stats, prefixes, suffixes | enriched `players_stats.json` + `failed_matches.json` |
| 4 | `stats_averager.py` | Averages stats per team+role slot and detects best series for GROUP / PLAYOFF | `players_stats_avg.json` |
| 5 | `hero.py` | Pulls the hero list from OpenDota and tags heroes with 8 flavor categories | `heroes.json` |
| 6 | `teams_icon_scraper.py` | Grabs team icons from Liquipedia | `teams_icon.json` |

<details>
<summary><strong>Pipeline detail (click to expand)</strong></summary>

1. **Player roster** — `players_scraper.py` queries Liquipedia's TI 2026 player table and saves each player's name, team, position (`Core` / `Mid` / `Support`), and DatDota player id.
2. **Match history** — `match_id_scraper.py` walks each player's Dotabuff esports match page filtered to the patch, recording `match_id`, `series_id`, and win/loss. Already-scraped matches are skipped, so reruns pick up where they left off.
3. **Stats** — `stats_parser.py` fetches every unique match from the OpenDota API and the STRATZ GraphQL API, then splits stats into **red / blue / green** groups depending on role, plus **prefixes** (hero categories) and **suffixes** (game-condition bonuses such as first-blood speed / torture kills / clutch).
4. **Aggregation** — `stats_averager.py` averages each team+role slot and, for BEST mode, finds the best series by GROUP and PLAYOFF formulas.
5. **Heroes** — `hero.py` caches the hero list from OpenDota and tags every hero with 8 categories (crimson, cerulean, emerald, royal, golden, elemental, otherworldly, heroic).
6. **Team icons** — `teams_icon_scraper.py` collects the team icon URL for every participant.
</details>

## Setup

```bash
# install the required libraries
pip install requests beautifulsoup4 cloudscraper selenium seleniumbase
```

- `requests` — used by `hero.py` and `stats_parser.py`
- `beautifulsoup4` — used by `match_id_scraper.py` for parsing pages
- `cloudscraper` — used by `stats_parser.py` to bypass Cloudflare when talking to STRATZ
- `selenium` — used by `players_scraper.py` and `teams_icon_scraper.py`
- `seleniumbase` — used by `match_id_scraper.py` for browsing Dotabuff

Before running the pipeline:
- **STRATZ API token** — needed by `stats_parser.py`; paste it into the `STRATZ_TOKEN` variable at the top of the file.
- **Dotabuff cookies** — needed by `match_id_scraper.py`; put a `cookies.json` export from a logged-in browser session next to the script.

## Run order

```bash
python players_scraper.py   # 1. roster -> players.json
python match_id_scraper.py  # 2. match history -> players_stats.json
python stats_parser.py      # 3. per-match stats -> players_stats.json (+ failed_matches.json)
python stats_averager.py    # 4. team+role averages -> players_stats_avg.json
python hero.py              # 5. heroes -> heroes.json
python teams_icon_scraper.py # 6. team icons -> teams_icon.json
```

## Outputs

All produced JSON files end up in the site's data folder: `the-insights-site/src/assets/data/`.

## Data sources

Liquipedia, Dotabuff, OpenDota, and STRATZ.