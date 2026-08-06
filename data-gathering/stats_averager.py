import json
from collections import defaultdict

# ==========================
# CONFIG
# ==========================

STAT_WEIGHTS = {
    'kills': 107,
    'deaths': 195,
    'creep_score': 3,
    'gpm': 2,
    'madstone_collected': 13,
    'tower_kills': 352,
    'obs_placed': 117,
    'camps_stacked': 234,
    'runes_grabbed': 141,
    'watchers_taken': 147,
    'smokes_used': 293,
    'roshan_kills': 1172,
    'teamfight_participation': 2124,
    'stuns': 10,
    'tormentor_kills': 879,
    'courier_kills': 703,
    'firstblood': 1934,
    'lotus_grabbed': 176
}

ROLE_FORMULAS = {
    "Core": {
        "group": {"red": 2, "green": 1},
        "playoff": {"red": 3, "green": 2},
    },
    "Mid": {
        "group": {"red": 1, "blue": 1, "green": 1},
        "playoff": {"red": 2, "blue": 1, "green": 2},
    },
    "Support": {
        "group": {"blue": 2, "green": 1},
        "playoff": {"blue": 3, "green": 2},
    }
}

# ==========================
# LOAD
# ==========================

with open("players.json", encoding="utf-8") as f:
    players = json.load(f)

with open("players_stats.json", encoding="utf-8") as f:
    player_stats = json.load(f)

player_info = {p["name"]: {"pos": p["pos"], "team": p["team"]} for p in players}

# ==========================
# HELPERS
# ==========================

def average_dict(matches, key):

    sums = {}
    count = 0

    for m in matches:

        if key not in m:
            continue

        count += 1

        for color, stats in m[key].items():

            sums.setdefault(color, {})

            for stat, value in stats.items():
                sums[color][stat] = sums[color].get(stat, 0) + value

    if count == 0:
        return {}

    for color in sums:
        for stat in sums[color]:
            sums[color][stat] /= count

    return sums


def average_bool(matches, key):

    sums = {}
    count = 0

    for m in matches:

        if key not in m:
            continue

        count += 1

        for k, v in m[key].items():
            sums[k] = sums.get(k, 0) + int(bool(v))

    if count == 0:
        return {}

    return {
        k: v / count
        for k, v in sums.items()
    }


def color_score(color_stats):

    weighted = []

    for stat, value in color_stats.items():

        weight = STAT_WEIGHTS.get(stat, 1)

        if stat == "deaths":
            weighted.append(1950 - (value * weight))
        else:
            weighted.append(value * weight)

    weighted.sort(reverse=True)

    return weighted


def match_score(match, formula):

    colors = {}

    for color, stats in match["stats"].items():
        colors[color] = color_score(stats)

    score = 0

    for color, amount in formula.items():

        if color not in colors:
            continue

        score += sum(colors[color][:amount])

    return score


def average_two_stats(stats_a, stats_b):

    result = {}

    for color in set(list(stats_a.keys()) + list(stats_b.keys())):

        result[color] = {}

        all_stats = set(list(stats_a.get(color, {}).keys()) + list(stats_b.get(color, {}).keys()))

        for stat in all_stats:
            val_a = stats_a.get(color, {}).get(stat, 0)
            val_b = stats_b.get(color, {}).get(stat, 0)
            result[color][stat] = (val_a + val_b) / 2

    return result


def average_two_bools(bools_a, bools_b):

    result = {}

    for k in set(list(bools_a.keys()) + list(bools_b.keys())):
        val_a = bools_a.get(k, 0)
        val_b = bools_b.get(k, 0)
        result[k] = (val_a + val_b) / 2

    return result


def average_games_by_match_id(matches, check_won=False):

    by_match = defaultdict(list)

    for m in matches:
        if "stats" in m:
            by_match[m["match_id"]].append(m)

    result = []

    for match_id, match_list in by_match.items():

        if check_won:
            won_values = set(m.get("won") for m in match_list)
            if len(won_values) > 1:
                continue

        if len(match_list) == 1:
            result.append(match_list[0])
        else:
            avg_stats = average_two_stats(match_list[0]["stats"], match_list[1]["stats"])
            result.append({
                "match_id": match_id,
                "series_id": match_list[0]["series_id"],
                "stats": avg_stats
            })

    return result


def best_pair_score(series_matches, formula):

    best = -1

    if len(series_matches) == 1:
        return match_score(series_matches[0], formula)

    for i in range(len(series_matches)):

        for j in range(i + 1, len(series_matches)):

            avg_stats = average_two_stats(
                series_matches[i]["stats"],
                series_matches[j]["stats"]
            )

            score = match_score({"stats": avg_stats}, formula)

            if score > best:
                best = score

    return best


def find_best_series(matches, pos):

    formulas = ROLE_FORMULAS[pos]

    by_series = defaultdict(list)

    for m in matches:

        if "stats" not in m:
            continue

        by_series[m["series_id"]].append(m)

    best_group_series = None
    best_playoff_series = None
    best_group_score = -1
    best_playoff_score = -1

    for series_id, series_matches in by_series.items():

        group_score = best_pair_score(series_matches, formulas["group"])
        playoff_score = best_pair_score(series_matches, formulas["playoff"])

        if group_score > best_group_score:
            best_group_score = group_score
            best_group_series = series_id

        if playoff_score > best_playoff_score:
            best_playoff_score = playoff_score
            best_playoff_series = series_id

    return best_group_series, best_playoff_series


def find_shared_best_series(matches_a, matches_b, pos):

    formulas = ROLE_FORMULAS[pos]

    by_series_a = defaultdict(list)
    by_series_b = defaultdict(list)

    for m in matches_a:
        if "stats" in m:
            by_series_a[m["series_id"]].append(m)

    for m in matches_b:
        if "stats" in m:
            by_series_b[m["series_id"]].append(m)

    shared_ids = set(by_series_a.keys()) & set(by_series_b.keys())

    best_group_series = None
    best_playoff_series = None
    best_group_score = -1
    best_playoff_score = -1

    for series_id in shared_ids:

        series_matches_a = by_series_a[series_id]
        series_matches_b = by_series_b[series_id]

        all_matches = series_matches_a + series_matches_b
        averaged_games = average_games_by_match_id(all_matches, check_won=True)

        group_score = best_pair_score(averaged_games, formulas["group"])
        playoff_score = best_pair_score(averaged_games, formulas["playoff"])

        if group_score > best_group_score:
            best_group_score = group_score
            best_group_series = series_id

        if playoff_score > best_playoff_score:
            best_playoff_score = playoff_score
            best_playoff_series = series_id

    return best_group_series, best_playoff_series

# ==========================
# MAIN
# ==========================

player_data = {}
player_matches = {}

for player in player_stats:

    name = player["name"]
    matches = player["matches"]
    pos = player_info[name]["pos"]

    group, playoff = find_best_series(matches, pos)

    player_data[name] = {

        "stats_avg":
            average_dict(matches, "stats"),

        "prefixes_avg":
            average_bool(matches, "prefixes"),

        "suffixes_avg":
            average_bool(matches, "suffixes"),

        "best_series_id_group":
            group,

        "best_series_id_playoff":
            playoff
    }

    player_matches[name] = matches

teams = defaultdict(lambda: defaultdict(list))

for name, data in player_data.items():

    info = player_info[name]
    teams[info["team"]][info["pos"]].append(name)

output = []

for team, roles in teams.items():

    for pos, names in roles.items():

        if pos == "Mid":

            name = names[0]
            d = player_data[name]

            output.append({
                "name": name,
                "team": team,
                "pos": pos,
                "stats_avg": d["stats_avg"],
                "prefixes_avg": d["prefixes_avg"],
                "suffixes_avg": d["suffixes_avg"],
                "best_series_id_group": d["best_series_id_group"],
                "best_series_id_playoff": d["best_series_id_playoff"]
            })

        else:

            name_a, name_b = names[0], names[1]
            da, db = player_data[name_a], player_data[name_b]

            shared_group, shared_playoff = find_shared_best_series(
                player_matches[name_a],
                player_matches[name_b],
                pos
            )

            output.append({
                "name": {"1": name_a, "2": name_b},
                "team": team,
                "pos": pos,
                "stats_avg": average_two_stats(da["stats_avg"], db["stats_avg"]),
                "prefixes_avg": average_two_bools(da["prefixes_avg"], db["prefixes_avg"]),
                "suffixes_avg": average_two_bools(da["suffixes_avg"], db["suffixes_avg"]),
                "best_series_id_group": shared_group,
                "best_series_id_playoff": shared_playoff
            })

# ==========================
# SAVE
# ==========================

with open(
    "players_stats_avg.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        output,
        f,
        ensure_ascii=False,
        indent=4
    )

print("Done.")
