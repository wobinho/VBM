import Database from 'better-sqlite3';

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(val)));
}

function rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function calculatePlayerValue(overall: number, age: number, attack: number, defense: number, serve: number, block: number, receive: number, setting: number) {
    const baseValue = overall * 5000;
    let ageMod = 1.0;
    if (age < 22) ageMod = 1.3;
    else if (age < 25) ageMod = 1.1;
    else if (age < 30) ageMod = 1.0;
    else if (age < 35) ageMod = 0.8;
    else ageMod = 0.6;
    const statBonus = (attack + defense + serve + block + receive + setting) * 50;
    return Math.round((baseValue * ageMod) + statBonus);
}

const COUNTRIES = ['Japan', 'Brazil', 'USA', 'Italy', 'Poland', 'France', 'Serbia', 'Argentina', 'Cuba', 'Russia', 'South Korea', 'China', 'Germany', 'Turkey', 'Canada', 'Iran', 'Australia', 'Netherlands'];
const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];
const FIRST_NAMES = ['Takeshi', 'Lucas', 'Marco', 'Alex', 'James', 'Yuki', 'Diego', 'Pavel', 'Andre', 'Liam', 'Noah', 'Carlos', 'Ivan', 'Felix', 'Oscar', 'Kai', 'Ryu', 'Ethan', 'Leo', 'Ren', 'Dante', 'Viktor', 'Sasha', 'Mateo', 'Hugo', 'Finn', 'Emil', 'Niko', 'Jiro', 'Tomas', 'Rafael', 'Sergei', 'Bruno', 'Axel', 'Hiro', 'Jun', 'Kyle', 'Max', 'Zane', 'Lars'];
const LAST_NAMES = ['Tanaka', 'Silva', 'Rossi', 'Johnson', 'Smith', 'Yamamoto', 'Rodriguez', 'Petrov', 'Santos', 'Williams', 'Brown', 'Garcia', 'Mueller', 'Volkov', 'Chen', 'Park', 'Kim', 'Wagner', 'Duval', 'Moreno', 'Hansen', 'Berg', 'Costa', 'Ferreira', 'Nakamura', 'Ishida', 'Clark', 'Lee', 'Stone', 'Rivera', 'Popov', 'Cruz', 'Wolf', 'Sato', 'Ito', 'Wright', 'Foster', 'Reed', 'Russo', 'Novak'];

function generatePlayer(teamId: number | null, jerseyNumber: number, overallTarget: number) {
    const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const age = clamp(Math.round(rand(18, 36)), 16, 50);
    const overall = clamp(Math.round(rand(overallTarget - 8, overallTarget + 8)), 40, 95);

    const attack = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const defense = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const serve = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const block = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const receive = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const setting = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);

    const speed = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const agility = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const strength = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const endurance = clamp(Math.round(overall * rand(0.6, 1.4)), 1, 100);
    const height = clamp(Math.round(rand(170, 205)), 150, 220);
    const leadership = clamp(Math.round(overall * rand(0.5, 1.3)), 1, 100);
    const teamwork = clamp(Math.round(overall * rand(0.6, 1.3)), 1, 100);
    const concentration = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const pressureHandling = clamp(Math.round(overall * rand(0.6, 1.3)), 1, 100);
    const jumpServe = clamp(Math.round(overall * rand(0.5, 1.3)), 1, 100);
    const floatServe = clamp(Math.round(overall * rand(0.6, 1.3)), 1, 100);
    const spikePower = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const spikeAccuracy = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);
    const blockTiming = clamp(Math.round(overall * rand(0.6, 1.3)), 1, 100);
    const digTechnique = clamp(Math.round(overall * rand(0.6, 1.3)), 1, 100);
    const experience = clamp(Math.round(age * 2 + rand(0, 20)), 1, 100);
    const potential = clamp(Math.round((100 - age) * 2 + rand(0, 30)), 1, 100);
    const consistency = clamp(Math.round(overall * rand(0.7, 1.3)), 1, 100);

    const contractYears = clamp(Math.round(rand(1, 5)), 1, 10);
    const monthlyWage = Math.round(overall * rand(50, 200));
    const playerValue = calculatePlayerValue(overall, age, attack, defense, serve, block, receive, setting);

    return {
        player_name: `${firstName} ${lastName}`,
        team_id: teamId,
        position,
        age,
        country,
        jersey_number: jerseyNumber,
        overall,
        attack, defense, serve, block, receive, setting,
        contract_years: contractYears,
        monthly_wage: monthlyWage,
        player_value: playerValue,
        speed, agility, strength, endurance, height,
        leadership, teamwork, concentration, pressure_handling: pressureHandling,
        jump_serve: jumpServe, float_serve: floatServe,
        spike_power: spikePower, spike_accuracy: spikeAccuracy,
        block_timing: blockTiming, dig_technique: digTechnique,
        experience, potential, consistency,
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
      contract_years, monthly_wage, player_value,
      speed, agility, strength, endurance, height,
      leadership, teamwork, concentration, pressure_handling,
      jump_serve, float_serve, spike_power, spike_accuracy,
      block_timing, dig_technique, experience, potential, consistency
    ) VALUES (
      @player_name, @team_id, @position, @age, @country, @jersey_number, @overall,
      @attack, @defense, @serve, @block, @receive, @setting,
      @contract_years, @monthly_wage, @player_value,
      @speed, @agility, @strength, @endurance, @height,
      @leadership, @teamwork, @concentration, @pressure_handling,
      @jump_serve, @float_serve, @spike_power, @spike_accuracy,
      @block_timing, @dig_technique, @experience, @potential, @consistency
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
