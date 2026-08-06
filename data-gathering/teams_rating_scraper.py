import json
from bs4 import BeautifulSoup
from statistics import mean
from time import sleep
from seleniumbase import SB

PATCH = "7.41"


def wait_for_cloudflare(sb, max_wait=30):
    """Wait if Cloudflare challenge is detected."""
    for _ in range(max_wait // 5):
        title = sb.get_title().lower()
        if "just a moment" in title or "checking" in title:
            print("Cloudflare detected, waiting 5s...")
            sleep(5)
        else:
            return
    print("Cloudflare wait timed out")

# ----------------------------------------
# Load teams
# ----------------------------------------
with open("teams.json", "r", encoding="utf-8") as f:
    teams = json.load(f)


# ----------------------------------------
# Get Glicko-2
# ----------------------------------------
def get_glicko(sb, team_id):
    url = f"https://api.datdota.com/teams/{team_id}"

    try:
        sb.open(url)
        wait_for_cloudflare(sb)
        sleep(1)

        soup = BeautifulSoup(sb.get_page_source(), "html.parser")

        for row in soup.find_all("tr"):

            cells = row.find_all("td")

            if len(cells) < 3:
                continue

            if cells[0].get_text(strip=True) == "GLICKO_2":
                try:
                    return float(cells[2].get_text(strip=True))
                except:
                    return None

    except Exception as e:
        print(f"Glicko error ({team_id}): {e}")

    return None


# ----------------------------------------
# Get ALL H2H
# ----------------------------------------
def get_all_h2h(sb, all_ids):
    ids = ",".join(all_ids)

    url = (
        "https://api.datdota.com/api/teams/head-to-head"
        f"?teams={ids}&patch={PATCH}"
    )

    try:
        sb.open(url)
        wait_for_cloudflare(sb)
        sleep(1)

        text = sb.get_page_source()
        # Extract JSON from <pre> or body
        soup = BeautifulSoup(text, "html.parser")
        pre = soup.find("pre")
        body_text = pre.get_text() if pre else soup.body.get_text()

        return json.loads(body_text).get("data", [])

    except Exception as e:
        print(f"H2H Error: {e}")
        return []


# ----------------------------------------
# Fetch Glicko Ratings
# ----------------------------------------
print("Fetching Glicko ratings...")

team_glicko = {}

with SB(uc=True) as sb:
    for team in teams:

        ratings = []

        for tid in team["team_id"].values():

            rating = get_glicko(sb, tid)

            if rating is not None:
                ratings.append(rating)

            sleep(0.2)

        team_glicko[team["team"]] = round(mean(ratings), 2) if ratings else None


# ----------------------------------------
# Build Lookup Tables
# ----------------------------------------
id_to_team = {}
all_ids = []

output = {}

for team in teams:

    output[team["team"]] = {
        "team": team["team"],
        "glicko_2": team_glicko[team["team"]],
        "h2h": {}
    }

    for tid in team["team_id"].values():
        tid = int(tid)
        id_to_team[tid] = team["team"]
        all_ids.append(str(tid))

# Initialize H2H
for teamA in teams:
    for teamB in teams:

        if teamA["team"] == teamB["team"]:
            continue

        output[teamA["team"]]["h2h"][teamB["team"]] = {
            "win": 0,
            "lose": 0
        }


# ----------------------------------------
# Fetch ALL H2H once
# ----------------------------------------
print("Fetching all Head-to-Head...")

with SB(uc=True) as sb:
    matches = get_all_h2h(sb, all_ids)

print(f"Received {len(matches)} H2H records")

for match in matches:

    idA = match["teamA"]["valveId"]
    idB = match["teamB"]["valveId"]

    if idA not in id_to_team or idB not in id_to_team:
        continue

    teamA = id_to_team[idA]
    teamB = id_to_team[idB]

    # Ignore historical IDs of the same organization
    if teamA == teamB:
        continue

    winsA = match["teamAWins"]
    winsB = match["teamBWins"]

    output[teamA]["h2h"][teamB]["win"] += winsA
    output[teamA]["h2h"][teamB]["lose"] += winsB

    output[teamB]["h2h"][teamA]["win"] += winsB
    output[teamB]["h2h"][teamA]["lose"] += winsA


# ----------------------------------------
# Save
# ----------------------------------------
with open("teams_rating.json", "w", encoding="utf-8") as f:
    json.dump(list(output.values()), f, indent=4, ensure_ascii=False)

print("Done.")