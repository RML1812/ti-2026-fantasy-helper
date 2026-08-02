import json
import time

from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

URL = "https://liquipedia.net/dota2/The_International/2026"

# Edge options
options = Options()
options.add_argument("--headless=new")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Edge(options=options)

try:
    print("Opening Liquipedia...")
    driver.get(URL)

    # Give Cloudflare/browser a few seconds
    time.sleep(5)

    # Wait until team cards exist
    WebDriverWait(driver, 30).until(
        EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, ".team-participant-card__opponent--square-icon")
        )
    )

    teams = []
    seen = set()

    cards = driver.find_elements(
        By.CSS_SELECTOR,
        ".team-participant-card__opponent--square-icon"
    )

    for card in cards:
        try:
            name = card.find_element(
                By.CSS_SELECTOR,
                "span.name a"
            ).text.strip()

            if name in seen:
                continue

            seen.add(name)

            img = card.find_element(
                By.CSS_SELECTOR,
                "span.team-template-image-icon img"
            )

            icon = img.get_attribute("src")

            teams.append({
                "team": name,
                "icon": icon
            })

        except Exception:
            continue

    with open("teams_icon.json", "w", encoding="utf-8") as f:
        json.dump(teams, f, indent=4, ensure_ascii=False)

    print(f"Saved {len(teams)} teams.")

finally:
    driver.quit()