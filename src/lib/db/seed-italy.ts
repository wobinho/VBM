import Database from 'better-sqlite3';
import type { LeagueConfig } from '../league-engine';
import { calculateOverall } from '../overall';
import { generateInitialStatPotentials } from '../potential-engine';

/**
 * Idempotent Italian league seeder.
 *
 * Inserts the IVL Premier Division (tier 2), IVL North (tier 3), IVL South (tier 3),
 * their teams (16 each), 7 players per team, league configs + presets, and the
 * promotion/relegation links between the three leagues. Mirrors the structure of
 * seedFrance so behavior across countries stays consistent.
 *
 * Team names match the legacy spike-dynasty.db so the region-correction migration
 * in index.ts (which references e.g. 'Milan Rossoneri', 'Roma Capitana') keeps
 * working without changes.
 */
export function seedItaly(db: Database.Database): void {
    const existing = db.prepare(
        "SELECT COUNT(*) as c FROM leagues WHERE country = 'Italy'"
    ).get() as { c: number };
    if (existing.c > 0) return;

    const run = db.transaction(() => {
        const { premierId, northId, southId } = insertItalianLeagues(db);
        insertItalianLeagueConfigs(db, premierId, northId, southId);
        insertItalianLeagueLinks(db, premierId, northId, southId);
        const teamIds = insertItalianTeams(db, premierId, northId, southId);
        insertItalianPlayers(db, teamIds);
    });
    run();
}

function insertItalianLeagues(db: Database.Database): { premierId: number; northId: number; southId: number } {
    const insert = db.prepare(
        "INSERT INTO leagues (league_name, country, tier) VALUES (?, 'Italy', ?)"
    );
    const premierId = Number(insert.run('IVL Premier Division', 2).lastInsertRowid);
    const northId = Number(insert.run('IVL North', 3).lastInsertRowid);
    const southId = Number(insert.run('IVL South', 3).lastInsertRowid);
    return { premierId, northId, southId };
}

function insertItalianLeagueConfigs(db: Database.Database, premierId: number, northId: number, southId: number): void {
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
    insertPreset.run('Italian Premier Division', JSON.stringify(premierConfig));
    insertPreset.run('Italian Division 2 Standard', JSON.stringify(div2Config));
}

function insertItalianLeagueLinks(db: Database.Database, premierId: number, northId: number, southId: number): void {
    const insertLink = db.prepare(
        "INSERT INTO league_links (from_league_id, to_league_id, from_condition, to_condition, priority) VALUES (?, ?, ?, ?, ?)"
    );
    insertLink.run(
        premierId, northId,
        JSON.stringify({ scope: 'conference', conference: 'north', position: 'bottom', count: 1 }),
        JSON.stringify({ region: 'north', position: 'any' }),
        1,
    );
    insertLink.run(
        premierId, southId,
        JSON.stringify({ scope: 'conference', conference: 'south', position: 'bottom', count: 1 }),
        JSON.stringify({ region: 'south', position: 'any' }),
        2,
    );
    insertLink.run(
        northId, premierId,
        JSON.stringify({ scope: 'whole_table', position: 'top', count: 1 }),
        JSON.stringify({ region: 'north', position: 'any' }),
        3,
    );
    insertLink.run(
        southId, premierId,
        JSON.stringify({ scope: 'whole_table', position: 'top', count: 1 }),
        JSON.stringify({ region: 'south', position: 'any' }),
        4,
    );
}

// Premier Division — 8 north + 8 south (region tags drive conference assignment)
const PREMIER_NORTH_TEAMS = [
    'Milan Rossoneri',
    'Milan Nerazzuri',
    'Turin Bianconeri',
    'Genoa Admirals',
    'Bologna Motors',
    'Zebrette Udine',
    'Arsenal Spezia',
    'Primogenita Piacenza',
];
const PREMIER_SOUTH_TEAMS = [
    'Rome Imperials',
    'Roma Capitana',
    'Partenope Napoli',
    'Palermo Royals',
    'Firenze Lillies',
    'Perugia Griffins',
    'Salerno Marittimo',
    'Pisa Towers',
];
const NORTH_FEEDER_TEAMS = [
    'Turin Bulls',
    'Sampdoria Tridents',
    'Venezia Republic',
    'Verona Arena',
    'Bologna Rosso',
    'Brescia Leonessa',
    'Farnese Parma',
    'Modena Velocity',
    'Bergamo Bastion',
    'Atalanta Heights',
    'Trento Elite',
    'Aquila North',
    'Bolzano Summit',
    'Sforzesca Novara',
    'Monza Corona',
    'Laguna Como',
];
const SOUTH_FEEDER_TEAMS = [
    'Vesuvius Fire',
    'Florence Medici',
    'Bari Saints',
    'Catania Elefantessa',
    'Messini Charybdis',
    'Reggio Bronze',
    'Cagliari Elite',
    'Candelieri Sassari',
    'Taranto Grande',
    'Taranto Piccolo',
    'Livorno Navale',
    'Foggia Grano',
    'Pescara Dolphins',
    'Lecce Salento',
    'Syracuse Tyrants',
    'Terni Thyrus',
];

function insertItalianTeams(db: Database.Database, premierId: number, northId: number, southId: number): number[] {
    const insertTeam = db.prepare(
        `INSERT INTO teams (team_name, league_id, country, region, team_money) VALUES (?, ?, 'Italy', ?, ?)`
    );

    const teamIds: number[] = [];

    for (const name of PREMIER_NORTH_TEAMS) {
        const id = Number(insertTeam.run(name, premierId, 'north', 2_000_000).lastInsertRowid);
        teamIds.push(id);
    }
    for (const name of PREMIER_SOUTH_TEAMS) {
        const id = Number(insertTeam.run(name, premierId, 'south', 2_000_000).lastInsertRowid);
        teamIds.push(id);
    }
    for (const name of NORTH_FEEDER_TEAMS) {
        const id = Number(insertTeam.run(name, northId, 'north', 750_000).lastInsertRowid);
        teamIds.push(id);
    }
    for (const name of SOUTH_FEEDER_TEAMS) {
        const id = Number(insertTeam.run(name, southId, 'south', 750_000).lastInsertRowid);
        teamIds.push(id);
    }

    return teamIds;
}

const ITALIAN_FIRST_NAMES = [
    'Marco', 'Luca', 'Alessandro', 'Andrea', 'Matteo', 'Lorenzo', 'Francesco', 'Davide',
    'Giuseppe', 'Antonio', 'Giovanni', 'Riccardo', 'Stefano', 'Federico', 'Simone', 'Tommaso',
    'Gabriele', 'Edoardo', 'Pietro', 'Filippo', 'Leonardo', 'Daniele', 'Nicolò', 'Mattia',
    'Emanuele', 'Salvatore', 'Vincenzo', 'Roberto', 'Paolo', 'Carlo', 'Massimo', 'Fabio',
    'Cristiano', 'Enrico', 'Alberto', 'Domenico', 'Raffaele', 'Michele', 'Dario', 'Manuel',
];

const ITALIAN_LAST_NAMES = [
    'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci',
    'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa',
    'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani',
    'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Gentile',
    'Martinelli', 'Vitale', 'Lombardo', 'Serra', 'Coppola', 'De Santis', 'Marchetti', 'Parisi',
];

function insertItalianPlayers(db: Database.Database, teamIds: number[]): void {
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
            insertPlayer.run(generateItalianPlayer(teamId, jersey, positionOrder[p]));
        }
    }
}

function generateItalianPlayer(teamId: number, jerseyNumber: number, position: string) {
    const firstName = pick(ITALIAN_FIRST_NAMES);
    const lastName = pick(ITALIAN_LAST_NAMES);
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
        country: 'Italy',
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
