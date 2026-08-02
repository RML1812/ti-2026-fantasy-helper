import json
import os
from bs4 import BeautifulSoup
from seleniumbase import SB

PATCH = "patch_7.41"
INPUT_FILE = "players.json"
OUTPUT_FILE = "players_stats.json"

def scrape_player(sb, player, existing_ids=None):
    player_id = player["player_id"]
    name = player["name"]

    print(f"Scraping {name}...")

    matches = []

    url = (
        f"https://www.dotabuff.com/esports/players/"
        f"{player_id}/matches?date={PATCH}"
    )

    while True:
        sb.open(url)
        sb.sleep(2)

        soup = BeautifulSoup(sb.get_page_source(), "html.parser")

        tables = soup.select("table.table.table-striped")

        if not tables:
            break

        table = tables[0]
        rows = table.select("tbody tr")

        found_existing = False

        for row in rows:
            match_link = row.select_one("a.won, a.lost")
            series_link = row.select_one('a[href*="/esports/series/"]')

            if not match_link:
                continue

            match_id = match_link["href"].split("/")[-1]

            if existing_ids and match_id in existing_ids:
                print(f"Match {match_id} already scraped for {player['name']}; stopping pagination.")
                found_existing = True
                break

            if not series_link:
                continue

            series_id = series_link["href"].split("/")[-1]
            won = "won" in match_link.get("class", [])

            matches.append({
                "match_id": match_id,
                "series_id": series_id,
                "won": won
            })

        print(f"Collected {len(matches)} matches so far.")

        if found_existing:
            break

        next_button = soup.select_one("span.next a")

        if next_button is None:
            break

        href = next_button["href"]

        if href.startswith("/"):
            url = "https://www.dotabuff.com" + href
        else:
            url = href

    return {
        "name": name,
        "matches": matches
    }

def load_dotabuff_cookies(sb, cookie_file):
    sb.open("https://www.dotabuff.com")

    with open(cookie_file, "r", encoding="utf-8") as f:
        cookies = json.load(f)

    for c in cookies:
        cookie = {
            "name": c["name"],
            "value": c["value"],
            "domain": c["domain"],
            "path": c.get("path", "/"),
            "secure": c.get("secure", False),
            "httpOnly": c.get("httpOnly", False),
        }

        expires = c.get("expires")

        if expires is not None and expires != -1:
            cookie["expiry"] = int(expires)

        if "sameSite" in c:
            cookie["sameSite"] = c["sameSite"]

        try:
            sb.driver.add_cookie(cookie)
        except Exception as e:
            print(f"Couldn't add {cookie['name']}: {e}")

    sb.refresh()

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        players = json.load(f)

    existing_by_name = {}

    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            existing_list = json.load(f)

        for entry in existing_list:
            existing_by_name[entry["name"]] = entry

    results = []

    with SB(uc=True, headless=False) as sb:
        load_dotabuff_cookies(sb, "cookies.json")
        sb.open("https://www.dotabuff.com")
        sb.sleep(5)

        for player in players:
            name = player["name"]

            try:
                old_entry = existing_by_name.get(name)
                existing_ids = {m["match_id"] for m in old_entry["matches"]} if old_entry else set()

                scraped = scrape_player(sb, player, existing_ids)

                if old_entry:
                    entry = {
                        "name": name,
                        "matches": scraped["matches"] + old_entry["matches"]
                    }
                else:
                    entry = scraped

                results.append(entry)

                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(results, f, indent=4)

            except Exception as e:
                print(f"Error with {player['name']}: {e}")

        for name, entry in existing_by_name.items():
            if not any(e["name"] == name for e in results):
                results.append(entry)

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=4)

    print("Done.")


if __name__ == "__main__":
    main()