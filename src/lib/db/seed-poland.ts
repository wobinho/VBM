import Database from 'better-sqlite3';
import type { LeagueConfig } from '../league-engine';
import { calculateOverall } from '../overall';
import { generateInitialStatPotentials } from '../potential-engine';

/**
 * Idempotent Polish league seeder.
 *
 * Inserts Polish Super League (tier 2), Polish Division 2 (tier 3),
 * Polish Division 3 (tier 3), their 48 teams (16 each), 7 players per team,
 * league configs + presets, and the promotion/relegation chain between the
 * three tiers (Super ↔ Div 2 ↔ Div 3, bottom/top 2 each).
 *
 * Single-table format throughout (no conferences). Tier 2 runs Jan–Apr with
 * a top-8 playoff bracket; tier 3 leagues run Jan–Jun without playoffs.
 */
export function seedPoland(db: Database.Database): void {
    const existing = db.prepare(
        "SELECT COUNT(*) as c FROM leagues WHERE country = 'Poland'"
    ).get() as { c: number };
    if (existing.c > 0) return;

    const run = db.transaction(() => {
        const { superId, div2Id, div3Id } = insertPolishLeagues(db);
        insertPolishLeagueConfigs(db, superId, div2Id, div3Id);
        insertPolishLeagueLinks(db, superId, div2Id, div3Id);
        const teamIds = insertPolishTeams(db, superId, div2Id, div3Id);
        insertPolishPlayers(db, teamIds);
    });
    run();
}

function insertPolishLeagues(db: Database.Database): { superId: number; div2Id: number; div3Id: number } {
    const insert = db.prepare(
        "INSERT INTO leagues (league_name, country, tier) VALUES (?, 'Poland', ?)"
    );
    const superId = Number(insert.run('Polish Super League', 2).lastInsertRowid);
    const div2Id  = Number(insert.run('Polish Division 2', 3).lastInsertRowid);
    const div3Id  = Number(insert.run('Polish Division 3', 3).lastInsertRowid);
    return { superId, div2Id, div3Id };
}

function insertPolishLeagueConfigs(db: Database.Database, superId: number, div2Id: number, div3Id: number): void {
    const superConfig: LeagueConfig = {
        team_count: 16,
        format: { type: 'single_table' },
        regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 4, end_day: 30 },
        post_season: {
            type: 'single_table_playoffs',
            start_month: 5,
            start_day: 1,
            series_length: 5,
            rounds: [
                { name: 'Quarter Finals', scope: 'whole_table', teams_count: 8, matchup_pattern: 'top_vs_bottom' },
                { name: 'Semi Finals',    scope: 'whole_table', matchup_pattern: 'top_vs_bottom' },
                { name: 'Grand Final',    scope: 'whole_table' },
            ],
        },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: {
            qualifier: 'top_n_per_league',
            top_n: 4,
            cups: ['national', 'cl'],
        },
    };

    const divConfig: LeagueConfig = {
        team_count: 16,
        format: { type: 'single_table' },
        regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 6, end_day: 30 },
        post_season: { type: 'none' },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: {
            qualifier: 'all_country',
            cups: ['national'],
        },
    };

    const insertCfg = db.prepare("INSERT OR IGNORE INTO league_configs (league_id, config) VALUES (?, ?)");
    insertCfg.run(superId, JSON.stringify(superConfig));
    insertCfg.run(div2Id,  JSON.stringify(divConfig));
    insertCfg.run(div3Id,  JSON.stringify(divConfig));

    const insertPreset = db.prepare("INSERT OR IGNORE INTO league_presets (preset_name, config) VALUES (?, ?)");
    insertPreset.run('Polish Super League',  JSON.stringify(superConfig));
    insertPreset.run('Polish Lower Division', JSON.stringify(divConfig));
}

function insertPolishLeagueLinks(db: Database.Database, superId: number, div2Id: number, div3Id: number): void {
    const insertLink = db.prepare(
        "INSERT INTO league_links (from_league_id, to_league_id, from_condition, to_condition, priority) VALUES (?, ?, ?, ?, ?)"
    );
    // Super League: bottom 2 relegate to Div 2
    insertLink.run(
        superId, div2Id,
        JSON.stringify({ scope: 'whole_table', position: 'bottom', count: 2 }),
        JSON.stringify({ position: 'any' }),
        1,
    );
    // Div 2: top 2 promote to Super League
    insertLink.run(
        div2Id, superId,
        JSON.stringify({ scope: 'whole_table', position: 'top', count: 2 }),
        JSON.stringify({ position: 'any' }),
        2,
    );
    // Div 2: bottom 2 relegate to Div 3
    insertLink.run(
        div2Id, div3Id,
        JSON.stringify({ scope: 'whole_table', position: 'bottom', count: 2 }),
        JSON.stringify({ position: 'any' }),
        3,
    );
    // Div 3: top 2 promote to Div 2
    insertLink.run(
        div3Id, div2Id,
        JSON.stringify({ scope: 'whole_table', position: 'top', count: 2 }),
        JSON.stringify({ position: 'any' }),
        4,
    );
}

// 16 Super League + 16 Div 2 + 16 Div 3 = 48 teams
const SUPER_TEAMS = [
    'Skra Bełchatów',
    'ZAKSA Kędzierzyn-Koźle',
    'Asseco Resovia',
    'Jastrzębski Węgiel',
    'Trefl Gdańsk',
    'Projekt Warszawa',
    'GKS Katowice',
    'Cuprum Lubin',
    'AZS Olsztyn',
    'Czarni Radom',
    'BBTS Bielsko-Biała',
    'MKS Będzin',
    'Stal Nysa',
    'Aluron Warta Zawiercie',
    'LUK Lublin',
    'Indykpol AZS Olsztyn',
];

const DIV2_TEAMS = [
    'Espadon Szczecin',
    'KPS Siedlce',
    'Krispol Września',
    'BKS Visła Bydgoszcz',
    'Mickiewicz Kluczbork',
    'Avia Świdnik',
    'Lechia Tomaszów Mazowiecki',
    'Effector Kielce',
    'Norwid Częstochowa',
    'Chemik Bydgoszcz',
    'TSV Sanok',
    'AZS Częstochowa',
    'Gwardia Wrocław',
    'Stocznia Szczecin',
    'Olimpia Sulęcin',
    'MUKS Krasnystaw',
];

const DIV3_TEAMS = [
    'Hutnik Kraków',
    'AZS Politechnika Warszawska',
    'SMS PZPS Spała',
    'KPS Skarżysko',
    'Astra Nowa Sól',
    'Sokół Gostyń',
    'Sparta Krzemieniewo',
    'AZS UJK Kielce',
    'Cerrad Czarni Radom II',
    'AZS UAM Poznań',
    'Volley Rybnik',
    'Karpaty Krosno',
    'Tubądzin Sieradz',
    'Czarni Słupsk',
    'Skra Bełchatów II',
    'Jastrzębski Węgiel II',
];

function insertPolishTeams(db: Database.Database, superId: number, div2Id: number, div3Id: number): number[] {
    const insertTeam = db.prepare(
        `INSERT INTO teams (team_name, league_id, country, region, team_money) VALUES (?, ?, 'Poland', NULL, ?)`
    );

    const teamIds: number[] = [];

    for (const name of SUPER_TEAMS) {
        teamIds.push(Number(insertTeam.run(name, superId, 2_000_000).lastInsertRowid));
    }
    for (const name of DIV2_TEAMS) {
        teamIds.push(Number(insertTeam.run(name, div2Id, 1_200_000).lastInsertRowid));
    }
    for (const name of DIV3_TEAMS) {
        teamIds.push(Number(insertTeam.run(name, div3Id, 750_000).lastInsertRowid));
    }

    return teamIds;
}

const POLISH_FIRST_NAMES = [
    'Jakub', 'Mateusz', 'Kacper', 'Michał', 'Bartosz', 'Wojciech', 'Tomasz', 'Krzysztof',
    'Piotr', 'Paweł', 'Andrzej', 'Marcin', 'Adam', 'Łukasz', 'Damian', 'Grzegorz',
    'Karol', 'Maciej', 'Filip', 'Patryk', 'Aleksander', 'Dawid', 'Konrad', 'Igor',
    'Rafał', 'Stanisław', 'Janusz', 'Zbigniew', 'Artur', 'Dariusz', 'Kamil', 'Norbert',
    'Hubert', 'Jan', 'Antoni', 'Szymon', 'Wiktor', 'Oskar', 'Dominik', 'Mikołaj',
];

const POLISH_LAST_NAMES = [
    'Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowski', 'Zieliński',
    'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk',
    'Piotrowski', 'Grabowski', 'Nowakowski', 'Pawłowski', 'Michalski', 'Zając', 'Król', 'Wieczorek',
    'Jabłoński', 'Wróbel', 'Nowicki', 'Majewski', 'Olszewski', 'Stępień', 'Jaworski', 'Adamczyk',
    'Dudek', 'Pawlak', 'Górski', 'Witkowski', 'Walczak', 'Sikora', 'Baran', 'Rutkowski',
];

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];

function insertPolishPlayers(db: Database.Database, teamIds: number[]): void {
    const insertPlayer = db.prepare(`
        INSERT INTO players (
            player_name, team_id, position, age, country, jersey_number, overall,
            attack, defense, serve, block, receive, setting,
            precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
            speed, agility, strength, endurance, vertical, flexibility, torque, balance,
            leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
            attack_potential, defense_potential, serve_potential, block_potential, receive_potential, setting_potential,
            precision_potential, flair_potential, digging_potential, positioning_potential, ball_control_potential, technique_potential, playmaking_potential, spin_potential,
            speed_potential, agility_potential, strength_potential, endurance_potential, vertical_potential, flexibility_potential, torque_potential, balance_potential,
            leadership_potential, teamwork_potential, concentration_potential, pressure_potential, consistency_potential, vision_potential, game_iq_potential, intimidation_potential,
            contract_years, monthly_wage, player_value
        ) VALUES (
            @player_name, @team_id, @position, @age, @country, @jersey_number, @overall,
            @attack, @defense, @serve, @block, @receive, @setting,
            @precision, @flair, @digging, @positioning, @ball_control, @technique, @playmaking, @spin,
            @speed, @agility, @strength, @endurance, @vertical, @flexibility, @torque, @balance,
            @leadership, @teamwork, @concentration, @pressure, @consistency, @vision, @game_iq, @intimidation,
            @attack_potential, @defense_potential, @serve_potential, @block_potential, @receive_potential, @setting_potential,
            @precision_potential, @flair_potential, @digging_potential, @positioning_potential, @ball_control_potential, @technique_potential, @playmaking_potential, @spin_potential,
            @speed_potential, @agility_potential, @strength_potential, @endurance_potential, @vertical_potential, @flexibility_potential, @torque_potential, @balance_potential,
            @leadership_potential, @teamwork_potential, @concentration_potential, @pressure_potential, @consistency_potential, @vision_potential, @game_iq_potential, @intimidation_potential,
            @contract_years, @monthly_wage, @player_value
        )
    `);

    const positionOrder = ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Middle Blocker', 'Outside Hitter', 'Libero'];

    for (const teamId of teamIds) {
        const usedJerseys = new Set<number>();
        for (let p = 0; p < 7; p++) {
            let jersey: number;
            do { jersey = randInt(1, 99); } while (usedJerseys.has(jersey));
            usedJerseys.add(jersey);
            insertPlayer.run(generatePolishPlayer(teamId, jersey, positionOrder[p]));
        }
    }
}

function generatePolishPlayer(teamId: number, jerseyNumber: number, position: string) {
    const firstName = pick(POLISH_FIRST_NAMES);
    const lastName = pick(POLISH_LAST_NAMES);
    const age = clamp(Math.round(randFloat(18, 36)), 16, 50);

    const overallTarget = randInt(60, 82);
    const s = (lo = 0.7, hi = 1.3) => clamp(Math.round(overallTarget * randFloat(lo, hi)), 1, 100);

    const attack = s();
    const defense = s();
    const serve = s();
    const block = s();
    const receive = s();
    const setting = s();

    const precision = s(0.65, 1.35);
    const flair = s(0.55, 1.40);
    const digging = s(0.65, 1.35);
    const positioning = s(0.70, 1.30);
    const ball_control = s(0.65, 1.35);
    const technique = s(0.65, 1.35);
    const playmaking = s(0.60, 1.35);
    const spin = s(0.55, 1.40);

    const speed = s(0.70, 1.30);
    const agility = s(0.70, 1.30);
    const strength = s(0.65, 1.35);
    const endurance = s(0.60, 1.40);
    const vertical = s(0.65, 1.35);
    const flexibility = s(0.65, 1.35);
    const torque = s(0.60, 1.35);
    const balance = s(0.70, 1.30);

    const leadership = s(0.50, 1.35);
    const teamwork = s(0.60, 1.30);
    const concentration = s(0.70, 1.30);
    const pressure = s(0.60, 1.30);
    const consistency = s(0.70, 1.30);
    const vision = s(0.60, 1.35);
    const game_iq = s(0.60, 1.35);
    const intimidation = s(0.50, 1.40);

    const overall = calculateOverall({
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
    }, position);

    const statPotentials = generateInitialStatPotentials({
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
    }, age, position);

    return {
        player_name: `${firstName} ${lastName}`,
        team_id: teamId,
        position,
        age,
        country: 'Poland',
        jersey_number: jerseyNumber,
        overall,
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
        ...statPotentials,
        contract_years: clamp(Math.round(randFloat(1, 5)), 1, 10),
        monthly_wage: Math.round(overall * randFloat(50, 200)),
        player_value: calculatePlayerValue(overall, age),
    };
}

function calculatePlayerValue(overall: number, age: number) {
    const baseValue = overall * 5000;
    let ageMod = 1.0;
    if (age < 22) ageMod = 1.3;
    else if (age < 25) ageMod = 1.1;
    else if (age < 30) ageMod = 1.0;
    else if (age < 35) ageMod = 0.8;
    else ageMod = 0.6;
    return Math.round(baseValue * ageMod);
}

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(val)));
}

function randFloat(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
