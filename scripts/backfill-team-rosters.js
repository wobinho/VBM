/**
 * One-time backfill: add 7 players (one per position) to every team that has
 * zero players in the `players` table. Safe to re-run — only acts on empty teams.
 *
 * Run:  node scripts/backfill-team-rosters.js
 *
 * Does NOT modify the application's seed pipeline, so deleting these rows and
 * restarting the dev server will NOT bring them back.
 */
const Database = require('better-sqlite3');
const path = require('path');

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Middle Blocker', 'Outside Hitter', 'Libero'];

const FIRST_NAMES = ['Takeshi', 'Lucas', 'Marco', 'Alex', 'James', 'Yuki', 'Diego', 'Pavel', 'Andre', 'Liam', 'Noah', 'Carlos', 'Ivan', 'Felix', 'Oscar', 'Kai', 'Ryu', 'Ethan', 'Leo', 'Ren', 'Dante', 'Viktor', 'Sasha', 'Mateo', 'Hugo', 'Finn', 'Emil', 'Niko', 'Jiro', 'Tomas', 'Rafael', 'Sergei', 'Bruno', 'Axel', 'Hiro', 'Jun', 'Kyle', 'Max', 'Zane', 'Lars'];
const LAST_NAMES = ['Tanaka', 'Silva', 'Rossi', 'Johnson', 'Smith', 'Yamamoto', 'Rodriguez', 'Petrov', 'Santos', 'Williams', 'Brown', 'Garcia', 'Mueller', 'Volkov', 'Chen', 'Park', 'Kim', 'Wagner', 'Duval', 'Moreno', 'Hansen', 'Berg', 'Costa', 'Ferreira', 'Nakamura', 'Ishida', 'Clark', 'Lee', 'Stone', 'Rivera', 'Popov', 'Cruz', 'Wolf', 'Sato', 'Ito', 'Wright', 'Foster', 'Reed', 'Russo', 'Novak'];

const COUNTRIES = ['JP', 'IT', 'BR', 'FR', 'PL', 'US', 'AR', 'RU', 'DE', 'CU', 'NL', 'BG', 'RS', 'IR', 'CN', 'KR'];

// Mirrors src/lib/overall.ts POSITION_GROUPINGS
const ALL_STAT_KEYS = [
    'attack', 'defense', 'serve', 'block', 'receive', 'setting',
    'precision', 'flair', 'digging', 'positioning', 'ball_control', 'technique', 'playmaking', 'spin',
    'speed', 'agility', 'strength', 'endurance', 'vertical', 'flexibility', 'torque', 'balance',
    'leadership', 'teamwork', 'concentration', 'pressure', 'consistency', 'vision', 'game_iq', 'intimidation',
];
const POSITION_GROUPINGS = {
    'Middle Blocker':  { main1: 'block',   main2: 'attack',     secondary: ['defense', 'vertical', 'positioning', 'precision', 'strength', 'endurance'] },
    'Setter':          { main1: 'setting', main2: 'playmaking', secondary: ['game_iq', 'vision', 'technique', 'teamwork', 'consistency', 'positioning'] },
    'Libero':          { main1: 'receive', main2: 'digging',    secondary: ['balance', 'flexibility', 'agility', 'speed', 'concentration', 'pressure'] },
    'Outside Hitter':  { main1: 'attack',  main2: 'defense',    secondary: ['strength', 'block', 'serve', 'receive', 'consistency', 'positioning'] },
    'Opposite Hitter': { main1: 'attack',  main2: 'defense',    secondary: ['strength', 'block', 'serve', 'receive', 'consistency', 'positioning'] },
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function calculateOverall(stats, position) {
    const g = POSITION_GROUPINGS[position];
    if (!g) {
        const sum = ALL_STAT_KEYS.reduce((a, k) => a + (stats[k] ?? 50), 0);
        return clamp(sum / ALL_STAT_KEYS.length, 1, 99);
    }
    const main1 = stats[g.main1] ?? 50;
    const main2 = stats[g.main2] ?? 50;
    const secAvg = g.secondary.reduce((a, k) => a + (stats[k] ?? 50), 0) / g.secondary.length;
    const used = new Set([g.main1, g.main2, ...g.secondary]);
    const otherKeys = ALL_STAT_KEYS.filter(k => !used.has(k));
    const otherAvg = otherKeys.reduce((a, k) => a + (stats[k] ?? 50), 0) / otherKeys.length;
    return clamp(main1 * 0.40 + main2 * 0.35 + secAvg * 0.20 + otherAvg * 0.05, 1, 99);
}

function calculatePlayerValue(overall, age) {
    const base = overall * 5000;
    const ageMod = age < 22 ? 1.3 : age < 25 ? 1.1 : age < 30 ? 1.0 : age < 35 ? 0.8 : 0.6;
    return Math.round(base * ageMod);
}

function generatePlayer(teamId, jerseyNumber, position, overallTarget) {
    const s = (lo = 0.70, hi = 1.30) => clamp(overallTarget * rand(lo, hi), 1, 100);

    const stats = {
        attack: s(), defense: s(), serve: s(), block: s(), receive: s(), setting: s(),
        precision: s(0.65, 1.35), flair: s(0.55, 1.40), digging: s(0.65, 1.35), positioning: s(0.70, 1.30),
        ball_control: s(0.65, 1.35), technique: s(0.65, 1.35), playmaking: s(0.60, 1.35), spin: s(0.55, 1.40),
        speed: s(0.70, 1.30), agility: s(0.70, 1.30), strength: s(0.65, 1.35), endurance: s(0.60, 1.40),
        vertical: s(0.65, 1.35), flexibility: s(0.65, 1.35), torque: s(0.60, 1.35), balance: s(0.70, 1.30),
        leadership: s(0.50, 1.35), teamwork: s(0.60, 1.30), concentration: s(0.70, 1.30),
        pressure: s(0.60, 1.30), consistency: s(0.70, 1.30), vision: s(0.60, 1.35),
        game_iq: s(0.60, 1.35), intimidation: s(0.50, 1.40),
    };

    const age = clamp(rand(18, 36), 16, 50);
    const overall = calculateOverall(stats, position);

    let headroom;
    if (age <= 20)      headroom = rand(8, 20);
    else if (age <= 23) headroom = rand(5, 14);
    else if (age <= 26) headroom = rand(2, 9);
    else if (age <= 30) headroom = rand(0, 5);
    else                headroom = rand(0, 2);
    const potential = clamp(overall + headroom, overall, 99);

    return {
        player_name: `${pickOne(FIRST_NAMES)} ${pickOne(LAST_NAMES)}`,
        team_id: teamId,
        position,
        age,
        country: pickOne(COUNTRIES),
        jersey_number: jerseyNumber,
        overall,
        potential,
        ...stats,
        contract_years: clamp(rand(1, 5), 1, 10),
        monthly_wage: Math.round(overall * rand(50, 200)),
        player_value: calculatePlayerValue(overall, age),
    };
}

const dbPath = path.join(__dirname, '..', 'spike-dynasty.db');
const db = new Database(dbPath);

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

try {
    // Teams with zero players
    const emptyTeams = db.prepare(`
        SELECT t.id, t.team_name
        FROM teams t
        LEFT JOIN players p ON p.team_id = t.id
        WHERE p.id IS NULL
        GROUP BY t.id
        ORDER BY t.id
    `).all();

    if (emptyTeams.length === 0) {
        console.log('No empty teams. Nothing to do.');
        process.exit(0);
    }

    console.log(`Found ${emptyTeams.length} empty teams. Backfilling 7 players each…`);

    const fill = db.transaction(() => {
        let inserted = 0;
        for (const team of emptyTeams) {
            const overallTarget = clamp(rand(62, 78), 50, 90);
            const usedJerseys = new Set();
            for (const pos of POSITIONS) {
                let jersey;
                do { jersey = clamp(rand(1, 99), 1, 99); } while (usedJerseys.has(jersey));
                usedJerseys.add(jersey);
                insertPlayer.run(generatePlayer(team.id, jersey, pos, overallTarget));
                inserted++;
            }
            console.log(`  team #${team.id} ${team.team_name} → 7 players (target OVR ${overallTarget})`);
        }
        return inserted;
    });

    const total = fill();
    console.log(`Done. Inserted ${total} players across ${emptyTeams.length} teams.`);
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
} finally {
    db.close();
}
