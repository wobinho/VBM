import Database from 'better-sqlite3';
import type { LeagueConfig } from '../league-engine';
import { calculateOverall } from '../overall';

/**
 * Idempotent French league seeder.
 *
 * Inserts the FVL Premier Division (tier 2), FVL North (tier 3), FVL South (tier 3),
 * their teams (16 each), 7 players per team, league configs + presets, and the
 * promotion/relegation links between the three leagues.
 *
 * Safe to call on every startup: a single guard check ("are any French leagues
 * already present?") short-circuits subsequent runs. Once seeded, nothing in
 * here ever re-creates or re-overwrites data — so a database refresh does NOT
 * re-seed the same teams/players.
 */
export function seedFrance(db: Database.Database): void {
    const existing = db.prepare(
        "SELECT COUNT(*) as c FROM leagues WHERE country = 'France'"
    ).get() as { c: number };
    if (existing.c > 0) return;

    const run = db.transaction(() => {
        const { premierId, northId, southId } = insertFrenchLeagues(db);
        insertFrenchLeagueConfigs(db, premierId, northId, southId);
        insertFrenchLeagueLinks(db, premierId, northId, southId);
        const teamIds = insertFrenchTeams(db, premierId, northId, southId);
        insertFrenchPlayers(db, teamIds);
    });
    run();
}

function insertFrenchLeagues(db: Database.Database): { premierId: number; northId: number; southId: number } {
    const insert = db.prepare(
        "INSERT INTO leagues (league_name, country, tier) VALUES (?, 'France', ?)"
    );
    const premierId = Number(insert.run('FVL Premier Division', 2).lastInsertRowid);
    const northId = Number(insert.run('FVL North', 3).lastInsertRowid);
    const southId = Number(insert.run('FVL South', 3).lastInsertRowid);
    return { premierId, northId, southId };
}

function insertFrenchLeagueConfigs(db: Database.Database, premierId: number, northId: number, southId: number): void {
    const premierConfig: LeagueConfig = {
        team_count: 16,
        format: {
            type: 'multi_conference',
            conferences: [
                { name: 'north', region_tag: 'north', size: 8 },
                { name: 'south', region_tag: 'south', size: 8 },
            ],
        },
        regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 4, end_day: 30 },
        post_season: {
            type: 'conference_playoffs',
            start_month: 5,
            start_day: 1,
            series_length: 5,
            rounds: [
                { name: 'Conference Semifinals', scope: 'per_conference', teams_per_conference: 4, matchup_pattern: 'top_vs_bottom' },
                { name: 'Conference Finals', scope: 'per_conference', matchup_pattern: 'top_vs_bottom' },
                { name: 'Grand Final', scope: 'cross_conference' },
            ],
        },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: {
            qualifier: 'top_n_per_league',
            top_n: 4,
            cups: ['national', 'cl'],
        },
    };

    const div2Config: LeagueConfig = {
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
    insertCfg.run(premierId, JSON.stringify(premierConfig));
    insertCfg.run(northId, JSON.stringify(div2Config));
    insertCfg.run(southId, JSON.stringify(div2Config));

    const insertPreset = db.prepare("INSERT OR IGNORE INTO league_presets (preset_name, config) VALUES (?, ?)");
    insertPreset.run('French Premier Division', JSON.stringify(premierConfig));
    insertPreset.run('French Division 2 Standard', JSON.stringify(div2Config));
}

function insertFrenchLeagueLinks(db: Database.Database, premierId: number, northId: number, southId: number): void {
    const insertLink = db.prepare(
        "INSERT INTO league_links (from_league_id, to_league_id, from_condition, to_condition, priority) VALUES (?, ?, ?, ?, ?)"
    );
    // Bottom of Premier North conference relegates to FVL North
    insertLink.run(
        premierId, northId,
        JSON.stringify({ scope: 'conference', conference: 'north', position: 'bottom', count: 1 }),
        JSON.stringify({ region: 'north', position: 'any' }),
        1,
    );
    // Bottom of Premier South conference relegates to FVL South
    insertLink.run(
        premierId, southId,
        JSON.stringify({ scope: 'conference', conference: 'south', position: 'bottom', count: 1 }),
        JSON.stringify({ region: 'south', position: 'any' }),
        2,
    );
    // Top of FVL North promotes to Premier (north conference)
    insertLink.run(
        northId, premierId,
        JSON.stringify({ scope: 'whole_table', position: 'top', count: 1 }),
        JSON.stringify({ region: 'north', position: 'any' }),
        3,
    );
    // Top of FVL South promotes to Premier (south conference)
    insertLink.run(
        southId, premierId,
        JSON.stringify({ scope: 'whole_table', position: 'top', count: 1 }),
        JSON.stringify({ region: 'south', position: 'any' }),
        4,
    );
}

// 16 Premier teams (8 north + 8 south), 16 north feeders, 16 south feeders
const PREMIER_NORTH_TEAMS = [
    'Paris Olympique',
    'Versailles Royale',
    'Lille Lions',
    'Reims Champagne',
    'Strasbourg Storks',
    'Nancy Lorraine',
    'Rouen Vikings',
    'Le Havre Mariners',
];
const PREMIER_SOUTH_TEAMS = [
    'Marseille Phocéens',
    'Olympique Lyonnais Volley',
    'Toulouse Violets',
    'Bordeaux Girondins',
    'Nice Azurs',
    'Montpellier Hérault',
    'Saint-Étienne Verts',
    'Nantes Canaris',
];
const NORTH_FEEDER_TEAMS = [
    'Amiens Picards',
    'Calais Boulonnais',
    'Caen Normands',
    'Brest Brestois',
    'Rennes Rouge-et-Noir',
    'Tours Mousquetaires',
    'Orléans Loiret',
    'Metz Grenats',
    'Mulhouse Alsace',
    'Dijon Bourgogne',
    'Besançon Comtois',
    'Saint-Quentin Picardie',
    'Dunkerque Maritime',
    'Châlons Cathédrale',
    'Vannes Korrigans',
    'Le Mans Sarthois',
];
const SOUTH_FEEDER_TEAMS = [
    'Toulon Mistral',
    'Cannes Croisette',
    'Avignon Palais',
    'Aix Provence',
    'Perpignan Catalans',
    'Béziers Languedoc',
    'Pau Béarn',
    'Bayonne Aviron',
    'Biarritz Olympique',
    'Limoges Cercle',
    'Clermont Auvergne',
    'Annecy Lac',
    'Grenoble Alpes',
    'Valence Drôme',
    'Nîmes Crocodiles',
    'Ajaccio Corsica',
];

function insertFrenchTeams(db: Database.Database, premierId: number, northId: number, southId: number): number[] {
    const insertTeam = db.prepare(
        `INSERT INTO teams (team_name, league_id, country, region, team_money) VALUES (?, ?, 'France', ?, ?)`
    );

    const teamIds: number[] = [];

    // Premier teams (north conference)
    for (const name of PREMIER_NORTH_TEAMS) {
        const money = randInt(10_000_000, 18_500_000);
        const id = Number(insertTeam.run(name, premierId, 'north', money).lastInsertRowid);
        teamIds.push(id);
    }
    // Premier teams (south conference)
    for (const name of PREMIER_SOUTH_TEAMS) {
        const money = randInt(10_000_000, 18_500_000);
        const id = Number(insertTeam.run(name, premierId, 'south', money).lastInsertRowid);
        teamIds.push(id);
    }
    // FVL North teams
    for (const name of NORTH_FEEDER_TEAMS) {
        const money = randInt(17_000_000, 18_500_000);
        const id = Number(insertTeam.run(name, northId, 'north', money).lastInsertRowid);
        teamIds.push(id);
    }
    // FVL South teams
    for (const name of SOUTH_FEEDER_TEAMS) {
        const money = randInt(17_000_000, 18_500_000);
        const id = Number(insertTeam.run(name, southId, 'south', money).lastInsertRowid);
        teamIds.push(id);
    }

    return teamIds;
}

const FRENCH_FIRST_NAMES = [
    'Antoine', 'Lucas', 'Hugo', 'Léo', 'Louis', 'Gabriel', 'Arthur', 'Raphaël',
    'Jules', 'Adam', 'Maël', 'Noah', 'Théo', 'Tom', 'Mathis', 'Nathan',
    'Ethan', 'Sacha', 'Liam', 'Aaron', 'Côme', 'Eliott', 'Maxime', 'Clément',
    'Baptiste', 'Romain', 'Julien', 'Nicolas', 'Pierre', 'Vincent', 'Alexandre',
    'François', 'Olivier', 'Thomas', 'Florian', 'Sébastien', 'Mathieu', 'Yannick',
    'Bastien', 'Quentin',
];

const FRENCH_LAST_NAMES = [
    'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
    'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
    'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Lefèvre',
    'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand',
    'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller', 'Henry', 'Roussel',
    'Nicolas',
];

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];

function insertFrenchPlayers(db: Database.Database, teamIds: number[]): void {
    const insertPlayer = db.prepare(`
        INSERT INTO players (
            player_name, team_id, position, age, country, jersey_number, overall, potential,
            attack, defense, serve, block, receive, setting,
            precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
            speed, agility, strength, endurance, vertical, flexibility, torque, balance,
            leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
            contract_years, monthly_wage, player_value
        ) VALUES (
            @player_name, @team_id, @position, @age, @country, @jersey_number, @overall, @potential,
            @attack, @defense, @serve, @block, @receive, @setting,
            @precision, @flair, @digging, @positioning, @ball_control, @technique, @playmaking, @spin,
            @speed, @agility, @strength, @endurance, @vertical, @flexibility, @torque, @balance,
            @leadership, @teamwork, @concentration, @pressure, @consistency, @vision, @game_iq, @intimidation,
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
            insertPlayer.run(generateFrenchPlayer(teamId, jersey, positionOrder[p]));
        }
    }
}

function generateFrenchPlayer(teamId: number, jerseyNumber: number, position: string) {
    const firstName = pick(FRENCH_FIRST_NAMES);
    const lastName = pick(FRENCH_LAST_NAMES);
    const age = clamp(Math.round(randFloat(18, 36)), 16, 50);

    // Target overall band similar to Italian seed (avg ~70)
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

    let headroom: number;
    if (age <= 20) headroom = randFloat(8, 20);
    else if (age <= 23) headroom = randFloat(5, 14);
    else if (age <= 26) headroom = randFloat(2, 9);
    else if (age <= 30) headroom = randFloat(0, 5);
    else headroom = randFloat(0, 2);
    const potential = clamp(overall + headroom, overall, 99);

    return {
        player_name: `${firstName} ${lastName}`,
        team_id: teamId,
        position,
        age,
        country: 'France',
        jersey_number: jerseyNumber,
        overall,
        potential,
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
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
