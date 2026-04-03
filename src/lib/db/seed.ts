import Database from 'better-sqlite3';
import { AVAILABLE_COUNTRY_CODES } from '../country-codes';

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(val)));
}

function rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function coreSkillByPosition(
    position: string,
    attack: number, defense: number, serve: number, block: number, receive: number, setting: number,
): number {
    switch (position) {
        case 'Libero':          return receive * 0.40 + defense * 0.40 + setting * 0.20;
        case 'Setter':          return setting * 0.50 + attack * 0.10 + defense * 0.10 + serve * 0.10 + block * 0.10;
        case 'Middle Blocker':  return attack * 0.30 + defense * 0.30 + block * 0.25 + serve * 0.10 + setting * 0.05;
        case 'Outside Hitter':
        case 'Opposite Hitter': return attack * 0.25 + defense * 0.25 + serve * 0.15 + block * 0.15 + receive * 0.15 + setting * 0.05;
        default:                return (attack + defense + serve + block + receive + setting) / 6;
    }
}

function calculateOverall(
    attack: number, defense: number, serve: number, block: number, receive: number, setting: number,
    speed: number, agility: number, strength: number, endurance: number, vertical: number, flexibility: number, torque: number, balance: number,
    leadership: number, teamwork: number, concentration: number, pressure: number, consistency: number, vision: number, game_iq: number, intimidation: number,
    position: string,
    precision: number, flair: number, digging: number, positioning: number,
    ball_control: number, technique: number, playmaking: number, spin: number,
): number {
    const coreSkill    = coreSkillByPosition(position, attack, defense, serve, block, receive, setting);
    const technicalAvg = (precision + flair + digging + positioning + ball_control + technique + playmaking + spin) / 8;
    const physicalAvg  = (speed + agility + strength + endurance + vertical + flexibility + torque + balance) / 8;
    const mentalAvg    = (leadership + teamwork + concentration + pressure + consistency + vision + game_iq + intimidation) / 8;
    return Math.max(1, Math.min(100, Math.round(coreSkill * 0.55 + technicalAvg * 0.15 + physicalAvg * 0.15 + mentalAvg * 0.15)));
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

const COUNTRIES = AVAILABLE_COUNTRY_CODES;
const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];
const FIRST_NAMES = ['Takeshi', 'Lucas', 'Marco', 'Alex', 'James', 'Yuki', 'Diego', 'Pavel', 'Andre', 'Liam', 'Noah', 'Carlos', 'Ivan', 'Felix', 'Oscar', 'Kai', 'Ryu', 'Ethan', 'Leo', 'Ren', 'Dante', 'Viktor', 'Sasha', 'Mateo', 'Hugo', 'Finn', 'Emil', 'Niko', 'Jiro', 'Tomas', 'Rafael', 'Sergei', 'Bruno', 'Axel', 'Hiro', 'Jun', 'Kyle', 'Max', 'Zane', 'Lars'];
const LAST_NAMES = ['Tanaka', 'Silva', 'Rossi', 'Johnson', 'Smith', 'Yamamoto', 'Rodriguez', 'Petrov', 'Santos', 'Williams', 'Brown', 'Garcia', 'Mueller', 'Volkov', 'Chen', 'Park', 'Kim', 'Wagner', 'Duval', 'Moreno', 'Hansen', 'Berg', 'Costa', 'Ferreira', 'Nakamura', 'Ishida', 'Clark', 'Lee', 'Stone', 'Rivera', 'Popov', 'Cruz', 'Wolf', 'Sato', 'Ito', 'Wright', 'Foster', 'Reed', 'Russo', 'Novak'];

function generatePlayer(teamId: number | null, jerseyNumber: number, overallTarget: number) {
    const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const age = clamp(Math.round(rand(18, 36)), 16, 50);

    // Generate core stats targeting overallTarget
    const s = (lo = 0.7, hi = 1.3) => clamp(Math.round(overallTarget * rand(lo, hi)), 1, 100);

    // Core Skills
    const attack       = s();
    const defense      = s();
    const serve        = s();
    const block        = s();
    const receive      = s();
    const setting      = s();

    // Technical Skills (influenced by core, higher variance)
    const precision    = s(0.65, 1.35);
    const flair        = s(0.55, 1.40);
    const digging      = s(0.65, 1.35);
    const positioning  = s(0.70, 1.30);
    const ball_control = s(0.65, 1.35);
    const technique    = s(0.65, 1.35);
    const playmaking   = s(0.60, 1.35);
    const spin         = s(0.55, 1.40);

    // Physical Skills
    const speed       = s(0.70, 1.30);
    const agility     = s(0.70, 1.30);
    const strength    = s(0.65, 1.35);
    const endurance   = s(0.60, 1.40);
    const vertical    = s(0.65, 1.35);
    const flexibility = s(0.65, 1.35);
    const torque      = s(0.60, 1.35);
    const balance     = s(0.70, 1.30);

    // Mental Skills
    const leadership   = s(0.50, 1.35);
    const teamwork     = s(0.60, 1.30);
    const concentration= s(0.70, 1.30);
    const pressure     = s(0.60, 1.30);
    const consistency  = s(0.70, 1.30);
    const vision       = s(0.60, 1.35);
    const game_iq      = s(0.60, 1.35);
    const intimidation = s(0.50, 1.40);

    const overall = calculateOverall(
        attack, defense, serve, block, receive, setting,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
        position,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
    );

    const contractYears = clamp(Math.round(rand(1, 5)), 1, 10);
    const monthlyWage = Math.round(overall * rand(50, 200));
    const playerValue = calculatePlayerValue(overall, age);

    return {
        player_name: `${firstName} ${lastName}`,
        team_id: teamId,
        position,
        age,
        country,
        jersey_number: jerseyNumber,
        overall,
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
        contract_years: contractYears,
        monthly_wage: monthlyWage,
        player_value: playerValue,
    };
}

export function seedDatabase(db: Database.Database) {
    const insertLeague = db.prepare('INSERT INTO leagues (league_name) VALUES (?)');
    insertLeague.run('VB League');
    insertLeague.run('VBL Division 2');

    const league1 = db.prepare("SELECT id FROM leagues WHERE league_name = 'VB League'").get() as { id: number };
    const league2 = db.prepare("SELECT id FROM leagues WHERE league_name = 'VBL Division 2'").get() as { id: number };

    const insertTeam = db.prepare(
        'INSERT INTO teams (team_name, league_id, team_money, stadium, capacity, founded, played, won, lost, points, goal_diff) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const teams = [
        { name: 'Your Team', leagueId: league1.id, money: 1000000, stadium: 'Victory Arena', capacity: 15000, founded: '2020', played: 12, won: 10, lost: 2, points: 30, goalDiff: 8 },
        { name: 'Thunder Bolts', leagueId: league1.id, money: 800000, stadium: 'Thunder Dome', capacity: 12000, founded: '2018', played: 12, won: 8, lost: 4, points: 24, goalDiff: 5 },
        { name: 'Storm Riders', leagueId: league1.id, money: 750000, stadium: 'Storm Center', capacity: 10000, founded: '2019', played: 12, won: 7, lost: 5, points: 21, goalDiff: 3 },
        { name: 'Wave Crushers', leagueId: league1.id, money: 600000, stadium: 'Wave Arena', capacity: 8000, founded: '2021', played: 12, won: 5, lost: 7, points: 15, goalDiff: -2 },
        { name: 'Rising Stars', leagueId: league2.id, money: 500000, stadium: 'Star Court', capacity: 6000, founded: '2022', played: 10, won: 7, lost: 3, points: 21, goalDiff: 4 },
        { name: 'Fire Hawks', leagueId: league2.id, money: 450000, stadium: 'Phoenix Arena', capacity: 5000, founded: '2020', played: 10, won: 6, lost: 4, points: 18, goalDiff: 2 },
        { name: 'Ice Breakers', leagueId: league2.id, money: 400000, stadium: 'Frost Center', capacity: 4000, founded: '2019', played: 10, won: 4, lost: 6, points: 12, goalDiff: -3 },
    ];

    const teamIds: number[] = [];
    for (const t of teams) {
        const result = insertTeam.run(t.name, t.leagueId, t.money, t.stadium, t.capacity, t.founded, t.played, t.won, t.lost, t.points, t.goalDiff);
        teamIds.push(Number(result.lastInsertRowid));
    }

    // Insert players for each team (10-12 players per team)
    const insertPlayer = db.prepare(`
    INSERT INTO players (
      player_name, team_id, position, age, country, jersey_number, overall,
      attack, defense, serve, block, receive, setting,
      precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
      speed, agility, strength, endurance, vertical, flexibility, torque, balance,
      leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
      contract_years, monthly_wage, player_value
    ) VALUES (
      @player_name, @team_id, @position, @age, @country, @jersey_number, @overall,
      @attack, @defense, @serve, @block, @receive, @setting,
      @precision, @flair, @digging, @positioning, @ball_control, @technique, @playmaking, @spin,
      @speed, @agility, @strength, @endurance, @vertical, @flexibility, @torque, @balance,
      @leadership, @teamwork, @concentration, @pressure, @consistency, @vision, @game_iq, @intimidation,
      @contract_years, @monthly_wage, @player_value
    )
  `);

    const overallTargets = [82, 78, 76, 72, 70, 68, 65]; // Decreasing quality per team

    const insertMany = db.transaction(() => {
        for (let t = 0; t < teamIds.length; t++) {
            const playerCount = Math.floor(rand(10, 13));
            const usedJerseys = new Set<number>();
            for (let p = 0; p < playerCount; p++) {
                let jersey: number;
                do { jersey = Math.floor(rand(1, 99)); } while (usedJerseys.has(jersey));
                usedJerseys.add(jersey);
                const player = generatePlayer(teamIds[t], jersey, overallTargets[t]);
                insertPlayer.run(player);
            }
        }

        // Free agents (15 players with no team)
        for (let i = 0; i < 15; i++) {
            const player = generatePlayer(null, Math.floor(rand(1, 99)), Math.floor(rand(55, 75)));
            insertPlayer.run(player);
        }
    });

    insertMany();
}
