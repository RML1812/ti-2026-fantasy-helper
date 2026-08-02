export interface Player {
    player_id: string;
    name: string;
    team: string;
    pos: "Core" | "Mid" | "Support";
}