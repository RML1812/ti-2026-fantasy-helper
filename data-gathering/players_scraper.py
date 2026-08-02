import json
import re
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

URL = "https://liquipedia.net/dota2/index.php?title=Special%3ARunQuery%2FTournament_player_information&pfRunQueryFormName=Tournament+player+information&wpRunQuery=Run+query&TPI%5Bpage%5D=The+International%2F2026"

POSITION_ORDER = [
    "Core",
    "Mid",
    "Core",
    "Support",
    "Support"
]

options = webdriver.EdgeOptions()
options.add_argument("--headless=new")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Edge(options=options)

driver.get("https://liquipedia.net/")
time.sleep(2)
driver.get(URL)

WebDriverWait(driver, 30).until(
    EC.presence_of_element_located((By.CSS_SELECTOR, "div.table2__container"))
)

container = driver.find_element(By.CSS_SELECTOR, "table.table2__table.sortable.jquery-tablesorter")
rows = container.find_elements(By.CSS_SELECTOR, "tr.table2__row--body")

players = []

for idx, row in enumerate(rows):
    try:
        pos = POSITION_ORDER[idx % 5]

        name_td = row.find_element(By.CSS_SELECTOR, "td[data-sort-value]")
        name = name_td.get_attribute("data-sort-value").strip()

        team = row.find_element(
            By.CSS_SELECTOR,
            "span.team-template-team-standard"
        ).get_attribute("data-highlighting-class").strip()

        player_id = None
        links = row.find_elements(By.CSS_SELECTOR, "a.external.text")

        for link in links:
            href = link.get_attribute("href")
            if href and "datdota.com/players/" in href:
                m = re.search(r"/players/(\d+)", href)
                if m:
                    player_id = m.group(1)
                break

        players.append({
            "player_id": player_id,
            "name": name,
            "team": team,
            "pos": pos
        })

    except Exception as e:
        print("Skipped row:", e)

driver.quit()

with open("players.json", "w", encoding="utf-8") as f:
    json.dump(players, f, indent=4, ensure_ascii=False)

print(f"Saved {len(players)} players.")

