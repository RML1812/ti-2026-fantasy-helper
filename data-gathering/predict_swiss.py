import json
from collections import defaultdict
import copy
import random
import itertools

ROUND_RULES = {
    1: {
        "name": "Opening Round",
        "pairing": "preset"
    },
    2: {
        "name": "Round 2",
        "pairing": "same_group"
    },
    3: {
        "name": "Round 3",
        "pairing": "same_group"
    },
    4: {
        "name": "Round 4",
        "pairing": "cross_group"
    },
    5: {
        "name": "Round 5",
        "pairing": "normal"
    },
    6: {
        "name": "Elimination",
        "pairing": "elimination"
    }
}

class Team:
    def __init__(self, data):
        self.name = data["team"]
        self.rating = data["glicko_2"]
        self.h2h = data.get("h2h", {})

class TournamentTeam:
    def __init__(self, team, group):
        self.team = team
        self.group = group
        self.match_wins = 0
        self.match_losses = 0
        self.game_wins = 0
        self.game_losses = 0
        self.opponents = []
        self.qualified = False
        self.eliminated = False
        self.rank = 0
        self.game_win_pct = 0
        self.buchholz = 0
        self.opponent_game_pct = 0
        self.h2h = team.h2h
        self.rating = team.rating
        self.name = team.name

class Tournament:
    def __init__(self, solution):
        self.teams = {}
        self.group_a = []
        self.group_b = []
        self.round = 1
        self.history = []
        self.final = {
            "qualified": [],
            "eliminated": []
        }
        team_map = {}
        for team in solution["group_a"]:
            wrapper = TournamentTeam(team, "A")
            self.teams[team.name] = wrapper
            team_map[team.name] = wrapper
            self.group_a.append(wrapper)
        for team in solution["group_b"]:
            wrapper = TournamentTeam(team, "B")
            self.teams[team.name] = wrapper
            team_map[team.name] = wrapper
            self.group_b.append(wrapper)
        self.round1_pairings = [
            (team_map[t1.name], team_map[t2.name])
            for t1, t2 in solution["round1"]["A"]
        ] + [
            (team_map[t1.name], team_map[t2.name])
            for t1, t2 in solution["round1"]["B"]
        ]

class RatingModel:
    def __init__(self, h2h_alpha=1, h2h_k=5, max_rating_bonus=100):
        self.h2h_alpha = h2h_alpha
        self.h2h_k = h2h_k
        self.max_rating_bonus = max_rating_bonus

    def expected_probability(self, rating_a, rating_b):
        return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

    def h2h_probability(self, wins, losses):
        alpha = self.h2h_alpha
        return (wins + alpha) / (wins + losses + alpha * 2)

    def confidence(self, wins, losses):
        matches = wins + losses
        return matches / (matches + self.h2h_k)

    def rating_bonus(self, h2h_probability, confidence):
        bonus = (h2h_probability - 0.5) * 2
        bonus *= confidence
        bonus *= self.max_rating_bonus
        return bonus

    def bo3_win_probability(self, p):
        return p * p * (3 - 2 * p)

    def predict(self, team_a, team_b):
        h2h_a = team_a.h2h.get(team_b.name, {"win": 0, "lose": 0})
        h2h_b = team_b.h2h.get(team_a.name, {"win": 0, "lose": 0})
        h2h_prob_a = self.h2h_probability(h2h_a["win"], h2h_a["lose"])
        h2h_prob_b = self.h2h_probability(h2h_b["win"], h2h_b["lose"])
        confidence_a = self.confidence(h2h_a["win"], h2h_a["lose"])
        confidence_b = self.confidence(h2h_b["win"], h2h_b["lose"])
        bonus_a = self.rating_bonus(h2h_prob_a, confidence_a)
        bonus_b = self.rating_bonus(h2h_prob_b, confidence_b)
        half = self.max_rating_bonus / 2
        bonus_a = min(bonus_a, half)
        bonus_b = min(bonus_b, half)
        rating_a = team_a.rating + bonus_a - bonus_b
        rating_b = team_b.rating + bonus_b - bonus_a
        game_probability = self.expected_probability(rating_a, rating_b)
        bo3_probability = self.bo3_win_probability(game_probability)
        if bo3_probability >= 0.94:
            score = "2-0"
        elif bo3_probability > 0.5:
            score = "2-1"
        elif bo3_probability >= 0.06:
            score = "1-2"
        else:
            score = "0-2"
        if score in ("2-0", "2-1"):
            winner = team_a.name
            loser = team_b.name
        else:
            winner = team_b.name
            loser = team_a.name
        return {
            "winner": winner,
            "loser": loser,
            "score": score,
            "match_probability": bo3_probability,
            "debug": {
                "base_rating_a": team_a.rating,
                "base_rating_b": team_b.rating,
                "effective_rating_a": rating_a,
                "effective_rating_b": rating_b,
                "h2h_a": {
                    "wins": h2h_a["win"],
                    "losses": h2h_a["lose"],
                    "probability": h2h_prob_a,
                    "confidence": confidence_a,
                    "rating_bonus": bonus_a
                },
                "h2h_b": {
                    "wins": h2h_b["win"],
                    "losses": h2h_b["lose"],
                    "probability": h2h_prob_b,
                    "confidence": confidence_b,
                    "rating_bonus": bonus_b
                }
            }
        }

class SwissEngine:
    def __init__(self, tournament):
        self.tournament = tournament

    def rank_teams(self):
        teams = list(self.tournament.teams.values())
        for team in teams:
            self.calculate_game_win_pct(team)
            self.calculate_buchholz(team)
            self.calculate_opponent_game_pct(team)
        ranked = sorted(
            teams,
            key=lambda t: (
                -t.match_wins,
                t.match_losses,
                -t.game_win_pct,
                -t.buchholz,
                -t.opponent_game_pct,
                t.team.name
            )
        )
        for i, team in enumerate(ranked, start=1):
            team.rank = i
        return ranked

    def split_pools(self):
        pools = defaultdict(list)
        for team in self.tournament.teams.values():
            if team.qualified:
                continue
            if team.eliminated:
                continue
            pools[(team.match_wins, team.match_losses)].append(team)
        return pools

    def calculate_game_win_pct(self, team):
        total = team.game_wins + team.game_losses
        if total == 0:
            team.game_win_pct = 0
        else:
            team.game_win_pct = team.game_wins / total

    def calculate_buchholz(self, team):
        total = 0
        for opponent in team.opponents:
            total += opponent.match_wins
        team.buchholz = total

    def calculate_opponent_game_pct(self, team):
        if len(team.opponents) == 0:
            team.opponent_game_pct = 0
            return
        total = 0
        for opponent in team.opponents:
            total += opponent.game_win_pct
        team.opponent_game_pct = total / len(team.opponents)

    def generate_all_pairings(self, teams):
        if len(teams) == 0:
            return [[]]
        first = teams[0]
        pairings = []
        for i in range(1, len(teams)):
            second = teams[i]
            remaining = teams[1:i] + teams[i+1:]
            for rest in self.generate_all_pairings(remaining):
                pairings.append(
                    [[first, second]] + rest
                )
        return pairings

    def contains_rematch(self, pairing):
        for team1, team2 in pairing:
            if team2 in team1.opponents:
                return True
        return False

    def pairing_distance(self, pairing):
        total = 0
        for team1, team2 in pairing:
            total += abs(team1.rank - team2.rank)
        return total

    def best_pairings(self, teams):
        if len(teams) > 8:
            return self.heuristic_pairings(teams)
        all_pairings = self.generate_all_pairings(teams)
        without_rematch = [
            p for p in all_pairings
            if not self.contains_rematch(p)
        ]
        if len(without_rematch):
            all_pairings = without_rematch
        all_pairings.sort(key=lambda p: self.pairing_distance(p))
        return all_pairings

    def heuristic_pairings(self, teams):
        sorted_teams = sorted(teams, key=lambda t: t.rank)
        base = []
        for i in range(0, len(sorted_teams), 2):
            base.append([sorted_teams[i], sorted_teams[i + 1]])
        results = [base]
        for i in range(0, len(base) - 1):
            variant = [list(p) for p in base]
            variant[i] = [base[i][0], base[i + 1][0]]
            variant[i + 1] = [base[i][1], base[i + 1][1]]
            results.append(variant)
        filtered = [p for p in results if not self.contains_rematch(p)]
        if filtered:
            results = filtered
        results.sort(key=lambda p: self.pairing_distance(p))
        return results

    def elimination_pairings(self, pool_32, pool_23, max_candidates):
        if len(pool_32) == 0 or len(pool_23) == 0:
            return []
        if len(pool_32) != len(pool_23):
            return []
        all_candidates = []
        for perm in itertools.permutations(pool_23):
            pairing = [(pool_32[i], perm[i]) for i in range(len(pool_32))]
            all_candidates.append(pairing)
            if len(all_candidates) >= max_candidates:
                break
        without_rematch = [
            p for p in all_candidates
            if not self.contains_rematch(p)
        ]
        if without_rematch:
            all_candidates = without_rematch
        all_candidates.sort(key=lambda c: self.pairing_distance(c))
        return all_candidates[:max_candidates]

    def next_round(self, max_candidates=500):
        if self.tournament.round == 1:
            return [self.tournament.round1_pairings]
        self.rank_teams()
        pools = self.split_pools()
        if self.tournament.round == 6:
            pool_32 = pools.get((3, 2), [])
            pool_23 = pools.get((2, 3), [])
            return self.elimination_pairings(pool_32, pool_23, max_candidates)
        pool_candidates = []
        for teams in pools.values():
            candidates = self.best_pairings(teams)
            pool_candidates.append(candidates)
        all_candidates = []
        for combination in itertools.product(*pool_candidates):
            merged = []
            for pool in combination:
                merged.extend(pool)
            all_candidates.append(merged)
            if len(all_candidates) >= max_candidates:
                break
        all_candidates.sort(key=lambda c: self.pairing_distance(c))
        return all_candidates[:max_candidates]

class TI2026Rules:
    ROUND_RULES = {
        1: "preset",
        2: "same_group",
        3: "same_group",
        4: "cross_group",
        5: "normal",
        6: "elimination"
    }

    def get_rule(self, round_number):
        return self.ROUND_RULES.get(round_number, "normal")

    def filter_pairings(self, candidates, round_number):
        if not candidates:
            return candidates
        rule = self.get_rule(round_number)
        if rule == "preset":
            return candidates
        if rule == "normal":
            return self.minimize_distance(candidates)
        if rule == "same_group":
            filtered = self._same_group(candidates)
            if filtered:
                return self.minimize_distance(filtered)
            return self.minimize_distance(candidates)
        if rule == "cross_group":
            filtered = self._cross_group(candidates)
            if filtered:
                return self.minimize_distance(filtered)
            return self.minimize_distance(candidates)
        if rule == "elimination":
            filtered = self._elimination(candidates)
            if filtered:
                return self.maximize_distance(filtered)
            return self.maximize_distance(candidates)
        return candidates

    def pairing_distance(self, pairing):
        total = 0
        for team1, team2 in pairing:
            total += abs(team1.rank - team2.rank)
        return total

    def minimize_distance(self, candidates):
        best = min(
            self.pairing_distance(c)
            for c in candidates
        )
        return [
            c for c in candidates
            if self.pairing_distance(c) == best
        ]

    def maximize_distance(self, candidates):
        best = max(
            self.pairing_distance(c)
            for c in candidates
        )
        return [
            c for c in candidates
            if self.pairing_distance(c) == best
        ]

    def _same_group(self, candidates):
        valid = []
        for pairing in candidates:
            legal = True
            for team1, team2 in pairing:
                if team1.group != team2.group:
                    legal = False
                    break
            if legal:
                valid.append(pairing)
        return valid

    def _cross_group(self, candidates):
        valid = []
        for pairing in candidates:
            legal = True
            for team1, team2 in pairing:
                if team1.group == team2.group:
                    legal = False
                    break
            if legal:
                valid.append(pairing)
        return valid

    def _normal(self, candidates):
        return self.minimize_distance(candidates)

    def _elimination(self, candidates):
        return candidates

    def build_result(self, candidates):
        if len(candidates) == 0:
            raise Exception("No legal pairing exists.")
        if len(candidates) == 1:
            return {
                "coin_toss": False,
                "matches": candidates[0]
            }
        return {
            "coin_toss": True,
            "choices": [
                {
                    "id": i + 1,
                    "matches": pairing
                }
                for i, pairing in enumerate(candidates)
            ]
        }

class Predictor:
    def __init__(self, tournament, rating_model, swiss_engine, rules):
        self.tournament = tournament
        self.rating_model = rating_model
        self.swiss = swiss_engine
        self.rules = rules

    def predict(self, tournament=None, depth=0):
        if tournament is None:
            tournament = self.tournament
        if self.finished(tournament):
            return [self.build_outcome(tournament)]
        swiss = SwissEngine(tournament)
        candidates = swiss.next_round()
        candidates = self.rules.filter_pairings(
            candidates,
            tournament.round
        )
        if not candidates:
            return [self.build_outcome(tournament)]
        result = self.rules.build_result(candidates)
        if not result["coin_toss"]:
            self.apply_round(tournament, result["matches"])
            return self.predict(tournament, depth)
        branches = []
        for choice in result["choices"]:
            copy_t = copy.deepcopy(tournament)
            remapped = self.remap_pairing(copy_t, choice["matches"])
            self.apply_round(copy_t, remapped)
            branches.extend(self.predict(copy_t, depth + 1))
        return branches

    def remap_pairing(self, tournament, pairing):
        team_map = {t.team.name: t for t in tournament.teams.values()}
        return [
            (team_map[t1.team.name], team_map[t2.team.name])
            for t1, t2 in pairing
        ]

    def apply_round(self, tournament, matches):
        round_history = {
            "round": tournament.round,
            "matches": []
        }
        for team1, team2 in matches:
            prediction = self.rating_model.predict(team1, team2)
            self.play_match(team1, team2, prediction)
            round_history["matches"].append({
                "team1": team1.team.name,
                "team2": team2.team.name,
                "winner": prediction["winner"],
                "score": prediction["score"],
                "probability": prediction["match_probability"]
            })
        tournament.history.append(round_history)
        tournament.round += 1

    def play_match(self, team1, team2, prediction):
        winner_name = prediction["winner"]
        score = prediction["score"]
        if winner_name == team1.team.name:
            winner = team1
            loser = team2
        else:
            winner = team2
            loser = team1
        winner_games, loser_games = map(int, score.split("-"))
        self.update_team(winner, loser, winner_games, loser_games)

    def update_team(self, winner, loser, winner_games, loser_games):
        winner.match_wins += 1
        loser.match_losses += 1
        winner.game_wins += winner_games
        winner.game_losses += loser_games
        loser.game_wins += loser_games
        loser.game_losses += winner_games
        winner.opponents.append(loser)
        loser.opponents.append(winner)
        if winner.match_wins >= 4 and not winner.qualified:
            winner.qualified = True
        if loser.match_losses >= 4 and not loser.eliminated:
            loser.eliminated = True

    def finished(self, tournament):
        return tournament.round > 6

    def build_outcome(self, tournament):
        qualified = []
        eliminated = []
        r6_winners = set()
        r6_losers = set()
        for round_data in tournament.history:
            if round_data["round"] == 6:
                for match in round_data["matches"]:
                    r6_winners.add(match["winner"])
                    loser = match["team2"] if match["winner"] == match["team1"] else match["team1"]
                    r6_losers.add(loser)
        for team in tournament.teams.values():
            name = team.team.name
            if team.qualified or name in r6_winners:
                qualified.append({"team": name})
            elif team.eliminated or name in r6_losers:
                eliminated.append({"team": name})
        return {
            "finished": True,
            "history": tournament.history,
            "qualified": qualified,
            "eliminated": eliminated
        }

    def export_json(self, outcomes):
        data = {
            "groups": {
                "A": {"teams": []},
                "B": {"teams": []}
            },
            "outcomes": outcomes
        }
        for team in self.tournament.group_a:
            data["groups"]["A"]["teams"].append(team.team.name)
        for team in self.tournament.group_b:
            data["groups"]["B"]["teams"].append(team.team.name)
        return data

class Organizer:
    CHINESE_TEAMS = {
        "Team Resilience",
        "Vici Gaming",
        "LGD Gaming",
        "Xtreme Gaming"
    }

    def __init__(self, teams, tournament_factory, predictor_factory):
        self.teams = teams
        self.tournament_factory = tournament_factory
        self.predictor_factory = predictor_factory

    def optimize(self, iterations=500):
        solution = self.generate_initial_solution()
        best_score = self.evaluate_solution(solution)
        best_solution = copy.deepcopy(solution)
        for i in range(iterations):
            candidate = self.mutate_solution(best_solution)
            score = self.evaluate_solution(candidate)
            if score > best_score:
                best_score = score
                best_solution = copy.deepcopy(candidate)
                print(f"Iteration {i}: 4c={score[0]} 3c={score[1]} 2c={score[2]} 1c={score[3]} 0c={-score[4]}")

            print(f"Iteration {i}")
        return {
            "solution": best_solution,
            "score": best_score
        }

    def generate_initial_solution(self):
        teams = self.teams[:]
        random.shuffle(teams)
        group_a = teams[:8]
        group_b = teams[8:]
        return {
            "group_a": group_a,
            "group_b": group_b,
            "round1": {
                "A": self.random_pairing(group_a),
                "B": self.random_pairing(group_b)
            }
        }

    def random_pairing(self, teams):
        teams = teams[:]
        random.shuffle(teams)
        matches = []
        while teams:
            matches.append(
                (teams.pop(), teams.pop())
            )
        return matches

    def mutate_solution(self, solution):
        child = copy.deepcopy(solution)
        mutation = random.randint(0, 2)
        if mutation == 0:
            ia = random.randrange(8)
            ib = random.randrange(8)
            child["group_a"][ia], child["group_b"][ib] = (
                child["group_b"][ib],
                child["group_a"][ia]
            )
            child["round1"]["A"] = self.random_pairing(child["group_a"])
            child["round1"]["B"] = self.random_pairing(child["group_b"])
        elif mutation == 1:
            child["round1"]["A"] = self.random_pairing(child["group_a"])
        else:
            child["round1"]["B"] = self.random_pairing(child["group_b"])
        return child

    def evaluate_solution(self, solution):
        counter = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
        tournament = self.tournament_factory(solution)
        predictor = self.predictor_factory(tournament)
        outcomes = predictor.predict()
        for outcome in outcomes:
            chinese = self.count_chinese_from_outcome(outcome)
            counter[chinese] += 1
        return (
            counter[4],
            counter[3],
            counter[2],
            counter[1],
            -counter[0]
        )

    def count_chinese_from_outcome(self, outcome):
        qualified = 0
        for entry in outcome["qualified"]:
            if entry["team"] in self.CHINESE_TEAMS:
                qualified += 1
        return qualified

    def count_chinese(self, tournament):
        qualified = 0
        for team in tournament.teams.values():
            if (
                team.team.name in self.CHINESE_TEAMS
                and
                team.qualified
            ):
                qualified += 1
        return qualified

def load_teams(filename):
    with open(filename, "r", encoding="utf-8") as f:
        data = json.load(f)
    teams = {}
    for item in data:
        team = Team(item)
        teams[team.name] = team
    return teams

def main():
    def tournament_factory(solution):
        return Tournament(solution)

    def predictor_factory(tournament):
        rating = RatingModel()
        swiss = SwissEngine(tournament)
        rules = TI2026Rules()
        return Predictor(tournament, rating, swiss, rules)

    with open("teams_rating.json", "r") as f:
        raw = json.load(f)
    teams = []
    for item in raw:
        teams.append(Team(item))

    organizer = Organizer(teams, tournament_factory, predictor_factory)
    best = organizer.optimize()
    tournament = tournament_factory(best["solution"])
    predictor = predictor_factory(tournament)
    outcomes = predictor.predict()

    chinese_teams = Organizer.CHINESE_TEAMS
    chinese_outcomes = []
    for o in outcomes:
        n = sum(1 for e in o["qualified"] if e["team"] in chinese_teams)
        if n == 0:
            continue
        delta = 0
        for rnd in o["history"]:
            for m in rnd["matches"]:
                if m["team1"] in chinese_teams or m["team2"] in chinese_teams:
                    w, l = map(int, m["score"].split("-"))
                    if m["winner"] in chinese_teams:
                        delta += w - l
                    else:
                        delta += l - w
        chinese_outcomes.append((n, delta, o))

    if chinese_outcomes:
        best_outcome = max(chinese_outcomes, key=lambda x: (x[0], x[1]))[2]
        result = predictor.export_json([best_outcome])
        print("Best Chinese outcome: " + str(sum(1 for e in best_outcome["qualified"] if e["team"] in chinese_teams)) + " teams qualified")
    else:
        result = predictor.export_json(outcomes)
        print("No Chinese team qualified in any outcome.")

    with open("predicted_swiss.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=4, ensure_ascii=False)
    print("Prediction complete.")

if __name__ == "__main__":
    main()
