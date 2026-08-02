import requests
import json

filename = 'heroes.json'

try:
    with open(filename, 'r', encoding='utf-8') as f:
        heroes_info = json.load(f)
except FileNotFoundError:
    heroes_info = {}

heroes = requests.get(f"https://api.opendota.com/api/heroes").json()

for hero in heroes:
    heroes_info[hero['id']] = {
        'name': hero['localized_name'],
        'attr': hero['primary_attr']
    }

categories = {
    "crimson": [
        "Axe", "Bloodseeker", "Shadow Fiend", "Pudge", "Sven", "Lina", "Sniper",
        "Warlock", "Beastmaster", "Dragon Knight", "Clockwerk", "Broodmother",
        "Jakiro", "Batrider", "Doom", "Lycan", "Brewmaster", "Shadow Demon",
        "Disruptor", "Nyx Assassin", "Troll Warlord", "Ember Spirit", "Phoenix",
        "Pangolier", "Mars", "Snapfire", "Primal Beast", "Ringmaster"
    ],
    "cerulean": [
        "Crystal Maiden", "Mirana", "Morphling", "Phantom Lancer", "Puck",
        "Razor", "Storm Spirit", "Sven", "Vengeful Spirit", "Zeus", "Lich",
        "Queen of Pain", "Luna", "Leshrac", "Huskar", "Night Stalker",
        "Weaver", "Jakiro", "Ancient Apparition", "Spirit Breaker",
        "Ogre Magi", "Io", "Visage", "Abaddon", "Oracle",
        "Winter Wyvern", "Arc Warden", "Muerta", "Kez"
    ],
    "emerald": [
        "Windranger", "Tidehunter", "Necrophos", "Venomancer", "Wraith King",
        "Phantom Assassin", "Pugna", "Viper", "Nature's Prophet",
        "Enchantress", "Outworld Destroyer", "Treant Protector", "Undying",
        "Rubick", "Naga Siren", "Medusa", "Earth Spirit", "Underlord",
        "Monkey King", "Dark Willow", "Hoodwink", "Muerta"
    ],
    "royal": [
        "Anti-Mage", "Bane", "Drow Ranger", "Lion", "Slardar",
        "Witch Doctor", "Riki", "Enigma", "Faceless Void",
        "Templar Assassin", "Dazzle", "Dark Seer", "Spectre",
        "Ursa", "Silencer", "Timbersaw", "Abaddon",
        "Terrorblade", "Dark Willow", "Void Spirit"
    ],
    "golden": [
        "Shadow Shaman", "Timbersaw", "Clinkz", "Bounty Hunter",
        "Batrider", "Chen", "Gyrocopter", "Alchemist",
        "Rubick", "Keeper of the Light", "Bristleback",
        "Elder Titan", "Phoenix", "Techies", "Dawnbreaker",
        "Ringmaster", "Earthshaker", "Sand King", "Tiny",
        "Lone Druid", "Treant Protector", "Centaur Warrunner",
        "Magnus", "Primal Beast"
    ],
    "elemental": [
        "Morphling", "Kunkka", "Slardar", "Tidehunter",
        "Naga Siren", "Slark", "Lina", "Dragon Knight",
        "Clinkz", "Huskar", "Jakiro", "Batrider",
        "Doom", "Invoker", "Brewmaster", "Ogre Magi",
        "Ember Spirit", "Phoenix", "Techies",
        "Dawnbreaker", "Crystal Maiden", "Drow Ranger",
        "Lich", "Ancient Apparition", "Tusk",
        "Winter Wyvern"
    ],
    "otherworldly": [
        "Pudge", "Vengeful Spirit", "Kunkka", "Lich",
        "Necrophos", "Wraith King", "Death Prophet",
        "Pugna", "Lifestealer", "Clinkz", "Huskar",
        "Spectre", "Undying", "Grimstroke",
        "Muerta", "Shadow Fiend", "Lion",
        "Queen of Pain", "Doom", "Shadow Demon",
        "Terrorblade", "Underlord", "Storm Spirit",
        "Ember Spirit", "Earth Spirit", "Void Spirit"
    ],
    "heroic": [
        "Bloodseeker", "Crystal Maiden", "Drow Ranger",
        "Windranger", "Lion", "Sniper", "Warlock",
        "Phantom Assassin", "Pugna", "Nature's Prophet",
        "Omniknight", "Batrider", "Invoker",
        "Shadow Demon", "Rubick", "Abaddon",
        "Oracle", "Arc Warden", "Monkey King",
        "Muerta", "Sven", "Shadow Shaman",
        "Tinker", "Clockwerk", "Bounty Hunter",
        "Gyrocopter", "Chaos Knight", "Grimstroke"
    ]
}

for hero_data in heroes_info.values():
    hero_name = hero_data["name"]

    for category, hero_list in categories.items():
        hero_data[category] = hero_name in hero_list

with open(filename, "w", encoding="utf-8") as f:
    json.dump(heroes_info, f, ensure_ascii=False, indent=4)