const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');

// I'll manually import the logic by reading the file if needed, 
// but it's simpler to just call the API or a script that imports it.
// Actually, I'll just run a script with npx tsx again, now that I know how to fix the import.

// Alternative: Just run the generation logic manually in JS for now to be sure.
// I'll read src/lib/league-engine.ts and src/lib/db/queries.ts to reproduce it.

const seasonId = 1;
const leagueId = 1;

// 1. Get top teams from each region
const teams = db.prepare('SELECT id, team_name, region, points, score_diff, sets_won, sets_lost FROM teams WHERE league_id = ?').all(leagueId);
const northTeams = teams.filter(t => t.region === 'north').sort((a,b) => b.points - a.points || b.score_diff - a.score_diff).slice(0, 4);
const southTeams = teams.filter(t => t.region === 'south').sort((a,b) => b.points - a.points || b.score_diff - a.score_diff).slice(0, 4);

console.log('Top North Teams:', northTeams.map(t => t.team_name));
console.log('Top South Teams:', southTeams.map(t => t.team_name));

if (northTeams.length === 4 && southTeams.length === 4) {
    console.log('--- Generating Round 1 Playoff Series ---');
    
    // Clear any existing series for this season (safeguard)
    db.prepare('DELETE FROM playoff_series WHERE season_id = ?').run(seasonId);

    // Round 1 anchor: May 1 (Fri), May 4 (Mon), May 6 (Wed), May 8 (Fri), May 11 (Mon)
    const dates = ['2026-05-01', '2026-05-04', '2026-05-06', '2026-05-08', '2026-05-11'];

    function createSeries(conf, highSeed, lowSeed, t1Id, t2Id) {
        const result = db.prepare(`
            INSERT INTO playoff_series (season_id, league_id, round, conference, seed_high, seed_low, home_team_id, away_team_id)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?)
        `).run(seasonId, leagueId, conf, highSeed, lowSeed, t1Id, t2Id);
        
        const seriesId = result.lastInsertRowid;
        for (let i = 0; i < 5; i++) {
            const h = (i === 0 || i === 1 || i === 4) ? t1Id : t2Id;
            const a = (i === 0 || i === 1 || i === 4) ? t2Id : t1Id;
            db.prepare(`
                INSERT INTO playoff_games (series_id, game_number, home_team_id, away_team_id, scheduled_date)
                VALUES (?, ?, ?, ?, ?)
            `).run(seriesId, i + 1, h, a, dates[i]);
        }
    }

    // North: 1v4, 2v3
    createSeries('north', 1, 4, northTeams[0].id, northTeams[3].id);
    createSeries('north', 2, 3, northTeams[1].id, northTeams[2].id);
    
    // South: 1v4, 2v3
    createSeries('south', 1, 4, southTeams[0].id, southTeams[3].id);
    createSeries('south', 2, 3, southTeams[1].id, southTeams[2].id);
    
    console.log('Playoff series and games generated for Round 1.');
} else {
    console.log('Not enough teams qualified yet or incorrect region tags.');
}

db.close();
