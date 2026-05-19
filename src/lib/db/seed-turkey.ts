import Database from 'better-sqlite3';
import type { LeagueConfig } from '../league-engine';
import { calculateOverall } from '../overall';

/**
 * Idempotent Turkish league seeder.
 *
 * Inserts Turkish Super League (tier 2), Turkish Division 2 (tier 3),
 * Turkish Division 3 (tier 3), their 48 teams (16 each), 7 players per team,
 * league configs + presets, and the promotion/relegation chain between the
 * three tiers (Super ↔ Div 2 ↔ Div 3, bottom/top 2 each).
 *
 * Single-table format throughout (no conferences). Tier 2 runs Jan–Apr with
 * a top-8 playoff bracket; tier 3 leagues run Jan–Jun without playoffs.
 */
export function seedTurkey(db: Database.Database): void {
    const existing = db.prepare(
        "SELECT COUNT(*) as c FROM leagues WHERE country = 'Turkey'"
    ).get() as { c: number };
    if (existing.c > 0) return;

    const run = db.transaction(() => {
        const { superId, div2Id, div3Id } = insertTurkishLeagues(db);
        insertTurkishLeagueConfigs(db, superId, div2Id, div3Id);
        insertTurkishLeagueLinks(db, superId, div2Id, div3Id);
        const teamIds = insertTurkishTeams(db, superId, div2Id, div3Id);
        insertTurkishPlayers(db, teamIds);
    });
    run();
}

function insertTurkishLeagues(db: Database.Database): { superId: number; div2Id: number; div3Id: number } {
    const insert = db.prepare(
        "INSERT INTO leagues (league_name, country, tier) VALUES (?, 'Turkey', ?)"
    );
    const superId = Number(insert.run('Turkish Super League', 2).lastInsertRowid);
    const div2Id  = Number(insert.run('Turkish Division 2', 3).lastInsertRowid);
    const div3Id  = Number(insert.run('Turkish Division 3', 3).lastInsertRowid);
    return { superId, div2Id, div3Id };
}

function insertTurkishLeagueConfigs(db: Database.Database, superId: number, div2Id: number, div3Id: number): void {
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
    insertPreset.run('Turkish Super League',   JSON.stringify(superConfig));
    insertPreset.run('Turkish Lower Division', JSON.stringify(divConfig));
}

function insertTurkishLeagueLinks(db: Database.Database, superId: number, div2Id: number, div3Id: number): void {
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

const SUPER_TEAMS = [
    'Fenerbahçe HDI Sigorta',
    'Halkbank Ankara',
    'Arkas Spor',
    'Galatasaray HDI Sigorta',
    'Ziraat Bankası',
    'Tokat Belediye Plevne',
    'İstanbul BBSK',
    'Spor Toto',
    'Bursa BBSK',
    'Develi Belediyespor',
    'Sorgun Belediyespor',
    'Akkuş Belediyespor',
    'Maliye Milli Piyango',
    'Solhan Spor',
    'Cizre Belediye',
    'Antalya 1207 Komakspor',
];

const DIV2_TEAMS = [
    'Altekma SK',
    'Anadolu Sigorta',
    'Karşıyaka Voleybol',
    'Bornova Belediyespor',
    'Eczacıbaşı Dynavit',
    'Erdek Belediye',
    'Kocaeli Büyükşehir',
    'Beşiktaş JK',
    'Adıyaman 02',
    'Yeşilyurt Belediyespor',
    'Mersin Büyükşehir',
    'Diyarbakır Büyükşehir',
    'Gaziantep Polisgücü',
    'Konyaaltı Belediye',
    'Eskişehir Voleybol',
    'Trabzon Hayrat',
];

const DIV3_TEAMS = [
    'Ankara Yenimahalle',
    'İBB Spor Kulübü',
    'Samsun Yıldırımspor',
    'Edirne Voleybol',
    'Tekirdağ Süleymanpaşa',
    'Çorum Belediyespor',
    'Kayseri Şeker Spor',
    'Manisa Büyükşehir',
    'Denizli Voleybol',
    'Sakarya Büyükşehir',
    'Aydın Efeler',
    'Kütahya Şekerspor',
    'Sivas Belediyespor',
    'Erzurum Büyükşehir',
    'Hatay Defne',
    'Çanakkale Belediye',
];

function insertTurkishTeams(db: Database.Database, superId: number, div2Id: number, div3Id: number): number[] {
    const insertTeam = db.prepare(
        `INSERT INTO teams (team_name, league_id, country, region, team_money) VALUES (?, ?, 'Turkey', NULL, ?)`
    );

    const teamIds: number[] = [];

    for (const name of SUPER_TEAMS) {
        const money = randInt(10_000_000, 18_500_000);
        teamIds.push(Number(insertTeam.run(name, superId, money).lastInsertRowid));
    }
    for (const name of DIV2_TEAMS) {
        const money = randInt(15_000_000, 18_000_000);
        teamIds.push(Number(insertTeam.run(name, div2Id, money).lastInsertRowid));
    }
    for (const name of DIV3_TEAMS) {
        const money = randInt(14_000_000, 17_500_000);
        teamIds.push(Number(insertTeam.run(name, div3Id, money).lastInsertRowid));
    }

    return teamIds;
}

const TURKISH_FIRST_NAMES = [
    'Mehmet', 'Mustafa', 'Ahmet', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'İsmail',
    'Murat', 'Emre', 'Burak', 'Onur', 'Kerem', 'Yusuf', 'Eren', 'Cem',
    'Berkay', 'Selçuk', 'Volkan', 'Arda', 'Caner', 'Hakan', 'Fatih', 'Serkan',
    'Tolga', 'Barış', 'Doğukan', 'Furkan', 'Efe', 'Mert', 'Kaan', 'Berk',
    'Bedirhan', 'Yiğit', 'Sinan', 'Tuncay', 'Erkan', 'Levent', 'Gökhan', 'Uğur',
];

const TURKISH_LAST_NAMES = [
    'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk',
    'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara',
    'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Erdoğan', 'Çakır',
    'Ateş', 'Acar', 'Bozkurt', 'Güneş', 'Karaca', 'Tekin', 'Yalçın', 'Avcı',
    'Türk', 'Bulut', 'Gül', 'Ekinci', 'Çiçek', 'Demirci', 'Sezer', 'Aksoy',
];

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];

function insertTurkishPlayers(db: Database.Database, teamIds: number[]): void {
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
            insertPlayer.run(generateTurkishPlayer(teamId, jersey, positionOrder[p]));
        }
    }
}

function generateTurkishPlayer(teamId: number, jerseyNumber: number, position: string) {
    const firstName = pick(TURKISH_FIRST_NAMES);
    const lastName = pick(TURKISH_LAST_NAMES);
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
        country: 'Turkey',
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
