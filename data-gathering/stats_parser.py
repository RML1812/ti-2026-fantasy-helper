import json
import time
import requests
import cloudscraper
from collections import defaultdict, deque

STRATZ_TOKEN = "put STRATZ API token here"

stratzUrl = "https://api.stratz.com/graphql"
scraper = cloudscraper.create_scraper()
OD_API = "https://api.opendota.com/api/matches/"


FAILED_MATCHES = []
MAX_RETRIES = 8
FORCE_REPARSE = False


RADIANT_AREA = {
    "min_x": 64,
    "max_x": 78,
    "min_y": 175,
    "max_y": 195,
}

DIRE_AREA = {
    "min_x": 177,
    "max_x": 195,
    "min_y": 64,
    "max_y": 82,
}


with open("heroes.json", "r", encoding="utf-8") as f:
    HEROES = json.load(f)

with open("players.json", "r", encoding="utf-8") as f:
    PLAYERS = json.load(f)

with open("players_stats.json", "r", encoding="utf-8") as f:
    PLAYER_STATS = json.load(f)


PLAYER_BY_NAME = {}
PLAYER_BY_ID = {}


for p in PLAYERS:
    PLAYER_BY_NAME[p["name"]] = p
    PLAYER_BY_ID[str(p["player_id"])] = p

match_owners = defaultdict(list)

for player in PLAYER_STATS:
    player_name = player["name"]

    for match in player["matches"]:
        match_id = str(match["match_id"])
        match_owners[match_id].append({
            "player_name": player_name,
            "match_ref": match
        })

print(f"Unique matches: {len(match_owners)}")

request_times = deque()
REQUEST_LIMIT = 55
WINDOW = 60
def fetch_opendota(match_id):
    url = OD_API + str(match_id)

    retries = 0

    while retries < MAX_RETRIES:
        now = time.time()

        while request_times and now - request_times[0] >= WINDOW:
            request_times.popleft()

        if len(request_times) >= REQUEST_LIMIT:
            wait = WINDOW - (now - request_times[0]) + 0.05
            print(f"[OpenDota] Rate limit reached. Waiting {wait:.2f}s...")
            time.sleep(wait)
            continue

        request_times.append(now)

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            data = response.json()

            if isinstance(data, dict) and "error" in data:
                raise ValueError(data["error"])

            if not isinstance(data, dict):
                raise ValueError("Response is not an object")

            if data.get("players") is None:
                raise ValueError("players is None")

            return data

        except Exception as e:
            retries += 1

            print(f"[OpenDota] Match {match_id}: {e}")
            print(f"[OpenDota] Retry {retries}/{MAX_RETRIES}")

            if retries >= MAX_RETRIES:
                print(f"[OpenDota] Giving up on {match_id}")

                FAILED_MATCHES.append({
                    "match_id": str(match_id),
                    "error": str(e)
                })

                return None

            time.sleep(15)


def fetch_stratz(match_id):
    retries = 0

    query = f"""
    {{
        match(id: {match_id}) {{
            id,
            firstBloodTime,
            series {{
                matches {{
                    id,
                    startDateTime
                }}
            }},
            players {{
                isRadiant,
                stats {{
                    deathEvents {{
                        positionX,
                        positionY
                    }}
                }}
            }}
        }}
    }}
    """

    while True:
        try:
            response = scraper.post(
                stratzUrl,
                json={"query": query},
                headers={"Authorization": f"Bearer {STRATZ_TOKEN}"},
                timeout=30,
            )

            response.raise_for_status()
            data = response.json()

            if "errors" in data:
                raise ValueError("Errors in data")

            match = data.get("data", {}).get("match")

            if match is None:
                raise ValueError("match is None")

            return match

        except Exception as e:
            retries += 1
            print(f"[STRATZ] Match {match_id}: {e}")
            print(f"[STRATZ] Retry {retries}/{MAX_RETRIES}")

            if retries >= MAX_RETRIES:
                print(f"[STRATZ] Giving up on {match_id}")
                FAILED_MATCHES.append({
                    "match_id": str(match_id),
                    "error": str(e)
                })
                return None

            time.sleep(15)


def find_player_row(match_data, steam_id):

    steam_id = str(steam_id)

    for player in match_data["players"]:

        if str(player.get("account_id")) == steam_id:
            return player

    return None


def get_hero_name(hero_id):

    hero = HEROES.get(str(hero_id))

    if hero:
        return hero["name"]

    return "Unknown"


def get_hero_data(hero_id):

    return HEROES.get(str(hero_id), {})


def inside_area(x, y, area):
    return (
        area["min_x"] <= x <= area["max_x"]
        and area["min_y"] <= y <= area["max_y"]
    )

def has_base_death(match):
    for player in match["players"]:
        area = RADIANT_AREA if player["isRadiant"] else DIRE_AREA

        death_events = player.get("stats", {}).get("deathEvents", [])

        if death_events is None:
            break

        for death in death_events:
            x = death.get("positionX")
            y = death.get("positionY")

            if x is None or y is None:
                continue

            if inside_area(x, y, area):
                return True

    return False


def is_last_match(match):
    last_match_id = None
    last_match_datetime = None

    for matches in match['series']['matches']:
        if not last_match_id:
            last_match_id = matches['id']
            last_match_datetime = matches['startDateTime']
        else:
            if last_match_datetime < matches['startDateTime']:
                last_match_id = matches['id']
                last_match_datetime = matches['startDateTime']

    if match['id'] == last_match_id:
        return True

    return False


def parse_player_match(player_row, match_opendota, match_stratz, hero_data, pos):

    hero_id = str(player_row["hero_id"])

    result = {
        "hero": hero_data[hero_id]["name"],
        "stats": {},
        "prefixes": {},
        "suffixes": {}
    }

    suffixes = {
        "tormented": False,
        "flayed_twins_acolyte": False,
        "patient": False,
        "underdog": False,
        "decisive": False,
        "clutch": False,
        "lucky": False,
        "cruel": False,
    }

    if match_opendota['duration'] < 1500:
        suffixes["decisive"] = True

    if "8" in f"{match_opendota['duration'] // 60}:{match_opendota['duration'] % 60:02d}":
        suffixes["lucky"] = True

    if player_row['lose'] == 1:
        suffixes["underdog"] = True

    if match_stratz['firstBloodTime'] > 600:
        suffixes["patient"] = True

    if match_stratz['firstBloodTime'] < 0:
        suffixes["flayed_twins_acolyte"] = True

    for player in match_opendota['players']:
        if player['killed_by'].get('npc_dota_miniboss', 0) > 0:
            suffixes["tormented"] = True
            break

    if has_base_death(match_stratz):
        suffixes["cruel"] = True

    if is_last_match(match_stratz):
        suffixes["clutch"] = True
 
    result["suffixes"] = suffixes

    stats = {}

    if pos == "Core":
        stats["red"] = {
            "kills": player_row["kills"],
            "deaths": player_row["deaths"],
            "creep_score": player_row["last_hits"] + player_row["denies"],
            "gpm": player_row["gold_per_min"],
            "madstone_collected":
                player_row.get("item_uses", {}).get("madstone_bundle", 0),
            "tower_kills": player_row["towers_killed"]
        }

    elif pos == "Mid":
        stats["red"] = {
            "kills": player_row["kills"],
            "deaths": player_row["deaths"],
            "creep_score": player_row["last_hits"] + player_row["denies"],
            "gpm": player_row["gold_per_min"],
            "madstone_collected":
                player_row.get("item_uses", {}).get("madstone_bundle", 0),
            "tower_kills": player_row["towers_killed"]
        }
        stats["blue"] = {
            "obs_placed": player_row["obs_placed"],
            "camps_stacked": player_row["camps_stacked"],
            "runes_grabbed": player_row["rune_pickups"],
            "watchers_taken":
                player_row.get("ability_uses", {}).get("ability_lamp_use", 0),
            "smokes_used":
                player_row.get("item_uses", {}).get("smoke_of_deceit", 0),
            "lotus_grabbed":
                player_row.get("item_uses", {}).get("famango", 0)
        }

    elif pos == "Support":

        stats["blue"] = {
            "obs_placed": player_row["obs_placed"],
            "camps_stacked": player_row["camps_stacked"],
            "runes_grabbed": player_row["rune_pickups"],
            "watchers_taken":
                player_row.get("ability_uses", {}).get("ability_lamp_use", 0),
            "smokes_used":
                player_row.get("item_uses", {}).get("smoke_of_deceit", 0),
            "lotus_grabbed":
                player_row.get("item_uses", {}).get("famango", 0)
        }

    stats["green"] = {
        "roshan_kills": player_row["roshans_killed"],
        "teamfight_participation": player_row["teamfight_participation"],
        "stuns": player_row["stuns"],
        "courier_kills": player_row["courier_kills"],
        "tormentor_kills":
            player_row.get("killed", {}).get("npc_dota_miniboss", 0),
        "firstblood": player_row["firstblood_claimed"]
    }

    result["stats"] = stats

    hero = hero_data[hero_id]

    prefixes = {
        "crimson": hero["crimson"],
        "cerulean": hero["cerulean"],
        "emerald": hero["emerald"],
        "royal": hero["royal"],
        "golden": hero["golden"],
        "elemental": hero["elemental"],
        "otherworldly": hero["otherworldly"],
        "heroic": hero["heroic"]
    }

    result["prefixes"] = prefixes

    return result


skipped = 0
for match_id, owners in match_owners.items():

    needs_processing = any(
        "stats" not in owner["match_ref"]
        for owner in owners
    )

    if not FORCE_REPARSE and not needs_processing:
        skipped += 1
        print(f"Skipping {match_id} (already parsed)")
        continue

    print(f"Parsing {match_id}")

    match_opendota = fetch_opendota(match_id)

    match_stratz = fetch_stratz(match_id)

    if (match_stratz is None) or (match_opendota is None):
        continue

    for owner in owners:

        player_name = owner["player_name"]

        match_object = owner["match_ref"]

        player_meta = PLAYER_BY_NAME[player_name]

        player_row = find_player_row(
            match_opendota,
            player_meta["player_id"]
        )

        if not player_row:
            print(f"{player_name} not found in {match_id}")
            continue

        parsed = parse_player_match(
            player_row,
            match_opendota,
            match_stratz,
            HEROES,
            player_meta["pos"]
        )

        match_object["hero"] = parsed["hero"]
        match_object["stats"] = parsed["stats"]
        match_object["prefixes"] = parsed["prefixes"]
        match_object["suffixes"] = parsed["suffixes"]

print(f"Skipped {skipped} already-parsed matches.")

with open(
    "players_stats.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        PLAYER_STATS,
        f,
        ensure_ascii=False,
        indent=4
    )

with open("failed_matches.json", "w", encoding="utf-8") as f:
    json.dump(FAILED_MATCHES, f, ensure_ascii=False, indent=4)

print(f"Failed matches: {len(FAILED_MATCHES)}")

print("Done.")