const Database = require('better-sqlite3');
const db = new Database('spike-dynasty.db');

console.log('--- Fixing Tiers ---');
db.prepare("UPDATE leagues SET tier = 2 WHERE league_name = 'IVL Premier Division'").run();
db.prepare("UPDATE leagues SET tier = 3 WHERE league_name IN ('IVL North', 'IVL South')").run();

const leagues = db.prepare('SELECT id, league_name, tier FROM leagues').all();
console.log('Current Leagues:', leagues);

const premierConfig = {
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

const div2Config = {
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

console.log('--- Seeding Configs ---');
const premierId = leagues.find(l => l.league_name === 'IVL Premier Division')?.id;
const northId = leagues.find(l => l.league_name === 'IVL North')?.id;
const southId = leagues.find(l => l.league_name === 'IVL South')?.id;

if (premierId) {
    db.prepare('INSERT OR REPLACE INTO league_configs (league_id, config) VALUES (?, ?)').run(premierId, JSON.stringify(premierConfig));
    console.log(`Seeded config for Premier (ID ${premierId})`);
}
if (northId) {
    db.prepare('INSERT OR REPLACE INTO league_configs (league_id, config) VALUES (?, ?)').run(northId, JSON.stringify(div2Config));
    console.log(`Seeded config for North (ID ${northId})`);
}
if (southId) {
    db.prepare('INSERT OR REPLACE INTO league_configs (league_id, config) VALUES (?, ?)').run(southId, JSON.stringify(div2Config));
    console.log(`Seeded config for South (ID ${southId})`);
}

const configs = db.prepare('SELECT league_id FROM league_configs').all();
console.log('Final Configs for league IDs:', configs);

db.close();
