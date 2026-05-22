/**
 * Custom-world seeder.
 *
 * Builds a fresh custom save's game DB from a CustomWorldConfig: leagues
 * (2-tier pyramids with promotion/relegation links), teams + rosters copied
 * from the catalog DB, league configs, seasons, fixtures and game state.
 *
 * Phase 2 keeps each selected team's original roster — the fantasy draft that
 * reshuffles players is Phase 4.
 */
import type Database from 'better-sqlite3';
import { runWithDb } from './db';
import {
    generateScheduleForLeague,
    type LeagueConfig,
    type PlayoffRoundDefinition,
} from './league-engine';
import {
    validateCustomWorldConfig, DRAFT_QUOTA,
    type CustomWorldConfig, type CustomPyramidConfig, type CustomTeamDef,
} from './custom-save';
import { generateCustomCup } from './custom-cup';
import { generatePlayer } from './player-gen';

type Db = Database.Database;
type Row = Record<string, unknown>;

/**
 * Server-side validation: structural checks plus a catalog existence check for
 * every selected team. Returns a list of errors (empty = valid).
 */
export function validateAgainstCatalog(config: CustomWorldConfig, catalogDb: Db): string[] {
    const errors = validateCustomWorldConfig(config);

    // Only positive ids reference the catalog; negative ids are from-scratch teams.
    const ids = new Set<number>();
    for (const p of config.pyramids ?? []) {
        for (const id of [...(p.tier1TeamIds ?? []), ...(p.tier2TeamIds ?? [])]) {
            if (id > 0) ids.add(id);
        }
    }
    const catalogName = new Map<number, string>();
    if (ids.size > 0) {
        const list = Array.from(ids);
        const placeholders = list.map(() => '?').join(',');
        const found = catalogDb.prepare(`SELECT id, team_name FROM teams WHERE id IN (${placeholders})`)
            .all(...list) as { id: number; team_name: string }[];
        for (const r of found) catalogName.set(r.id, r.team_name);
        if (found.length !== ids.size) errors.push('One or more selected teams no longer exist.');
    }

    // Every team becomes a row in teams.team_name (UNIQUE) — resolve each team's
    // final name and reject collisions up front so the build can't fail mid-way.
    const finalNames = new Map<string, number>();
    for (const p of config.pyramids ?? []) {
        const customById = new Map((p.customTeams ?? []).map(c => [c.id, c]));
        for (const id of [...(p.tier1TeamIds ?? []), ...(p.tier2TeamIds ?? [])]) {
            let name: string;
            if (id < 0) {
                name = (customById.get(id)?.name ?? '').trim();
            } else {
                const renamed = String((p.teamNames ?? {})[String(id)] ?? '').trim();
                name = renamed || (catalogName.get(id) ?? '').trim();
            }
            if (!name) continue;
            const key = name.toLowerCase();
            finalNames.set(key, (finalNames.get(key) ?? 0) + 1);
        }
    }
    for (const count of finalNames.values()) {
        if (count > 1) { errors.push('Two teams in your save would share the same name — rename one.'); break; }
    }
    return errors;
}

/** Builds the playoff round ladder for a top-N single-table bracket. */
function buildPlayoffRounds(topN: number): PlayoffRoundDefinition[] {
    const nameFor = (size: number): string => {
        switch (size) {
            case 2: return 'Grand Final';
            case 4: return 'Semi Finals';
            case 8: return 'Quarter Finals';
            case 16: return 'Round of 16';
            default: return `Round of ${size}`;
        }
    };
    const rounds: PlayoffRoundDefinition[] = [];
    let size = topN;
    let first = true;
    while (size >= 2) {
        rounds.push({
            name: nameFor(size),
            scope: 'whole_table',
            matchup_pattern: 'top_vs_bottom',
            ...(first ? { teams_count: topN } : {}),
        });
        first = false;
        size = Math.floor(size / 2);
    }
    return rounds;
}

/** Builds the league_configs JSON for one tier of a pyramid. */
function buildTierConfig(p: CustomPyramidConfig, tier: 1 | 2): LeagueConfig {
    const teamCount = (tier === 1 ? p.tier1TeamIds : p.tier2TeamIds).length;
    const hasPlayoff = tier === 1 && p.playoffEnabled;
    return {
        team_count: teamCount,
        format: { type: 'single_table' },
        regular_season: { rounds: p.rounds, start_month: 1, start_day: 1, end_month: 4, end_day: 30 },
        post_season: hasPlayoff
            ? {
                type: 'single_table_playoffs',
                start_month: 5,
                start_day: 1,
                series_length: p.seriesLength,
                rounds: buildPlayoffRounds(p.playoffTopN),
            }
            : { type: 'none' },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: { qualifier: 'none', cups: [] },
    };
}

/** Resolves a continent for a domestic league by looking at the catalog. */
function continentForCountry(catalogDb: Db, country: string): string {
    const row = catalogDb.prepare(
        'SELECT continent FROM leagues WHERE country = ? AND continent IS NOT NULL LIMIT 1'
    ).get(country) as { continent: string } | undefined;
    return row?.continent ?? 'Europe';
}

/** Auto-picks a starting 7 for a team and writes its squad_lineups row. */
export function autoPickLineup(customDb: Db, teamId: number): void {
    type PRow = { id: number; position: string; overall: number };
    const players = customDb.prepare(
        'SELECT id, position, overall FROM players WHERE team_id = ? ORDER BY overall DESC'
    ).all(teamId) as PRow[];
    if (players.length === 0) return;

    const byPos: Record<string, PRow[]> = {};
    for (const p of players) (byPos[p.position] ||= []).push(p);

    const used = new Set<number>();
    const pick = (pos: string): number | null => {
        const p = (byPos[pos] ?? []).find(x => !used.has(x.id));
        if (p) { used.add(p.id); return p.id; }
        return null;
    };
    const pickAny = (): number | null => {
        for (const pos of ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero']) {
            const id = pick(pos);
            if (id !== null) return id;
        }
        const p = players.find(x => !used.has(x.id));
        if (p) { used.add(p.id); return p.id; }
        return null;
    };

    const oh1 = pick('Outside Hitter') ?? pickAny();
    const mb1 = pick('Middle Blocker') ?? pickAny();
    const opp = pick('Opposite Hitter') ?? pickAny();
    const s = pick('Setter') ?? pickAny();
    const mb2 = pick('Middle Blocker') ?? pickAny();
    const oh2 = pick('Outside Hitter') ?? pickAny();
    const lib = pick('Libero') ?? pickAny();

    customDb.prepare(`
        INSERT INTO squad_lineups
            (team_id, oh1_player_id, mb1_player_id, opp_player_id, s_player_id, mb2_player_id, oh2_player_id, l_player_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(teamId, oh1, mb1, opp, s, mb2, oh2, lib);
}

/**
 * Builds the full game world for a custom save. `customDb` must already have an
 * empty schema (see initializeCustomDb); `catalogDb` is the pristine source.
 */
export function seedCustomWorld(customDb: Db, catalogDb: Db, config: CustomWorldConfig): void {
    const year = config.startYear || 2026;
    const draftEnabled = !!config.draft?.enabled;

    const colsOf = (table: string): string[] =>
        (customDb.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
            .map(c => c.name).filter(c => c !== 'id');
    const teamCols = colsOf('teams');
    const playerCols = colsOf('players');

    // Maps a catalog team id to its freshly-inserted id in the custom DB.
    const teamIdMap = new Map<number, number>();

    const insertLeague = customDb.prepare(
        'INSERT INTO leagues (league_name, country, tier, continent) VALUES (?, ?, ?, ?)'
    );
    const insertConfig = customDb.prepare(
        'INSERT INTO league_configs (league_id, config) VALUES (?, ?)'
    );
    const insertLink = customDb.prepare(
        'INSERT INTO league_links (from_league_id, to_league_id, from_condition, to_condition, priority) VALUES (?, ?, ?, ?, ?)'
    );
    const insertTeam = customDb.prepare(
        `INSERT INTO teams (${teamCols.join(', ')}) VALUES (${teamCols.map(c => '@' + c).join(', ')})`
    );
    const insertPlayer = customDb.prepare(
        `INSERT INTO players (${playerCols.join(', ')}) VALUES (${playerCols.map(c => '@' + c).join(', ')})`
    );
    const insertGeneratedStmt = customDb.prepare(`
        INSERT INTO players (
            player_name, team_id, position, age, country, jersey_number, overall, potential, height,
            attack, defense, serve, block, receive, setting,
            precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
            speed, agility, strength, endurance, vertical, flexibility, torque, balance,
            leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
            contract_years, monthly_wage, player_value, matches_played
        ) VALUES (
            @player_name, @team_id, @position, @age, @country, @jersey_number, @overall, @potential, @height,
            @attack, @defense, @serve, @block, @receive, @setting,
            @precision, @flair, @digging, @positioning, @ball_control, @technique, @playmaking, @spin,
            @speed, @agility, @strength, @endurance, @vertical, @flexibility, @torque, @balance,
            @leadership, @teamwork, @concentration, @pressure, @consistency, @vision, @game_iq, @intimidation,
            @contract_years, @monthly_wage, @player_value, 0
        )
    `);
    const insertSeason = customDb.prepare(
        'INSERT INTO seasons (league_id, year, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)'
    );
    const insertFixture = customDb.prepare(`
        INSERT INTO fixtures (season_id, league_id, home_team_id, away_team_id, game_week, scheduled_date)
        VALUES (@season_id, @league_id, @home_team_id, @away_team_id, @game_week, @scheduled_date)
    `);

    const getCatalogTeam = catalogDb.prepare('SELECT * FROM teams WHERE id = ?');
    const getCatalogPlayers = catalogDb.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY id');

    /** Copies one catalog team (+ its roster) into the custom DB. */
    function copyTeam(originalId: number, newLeagueId: number, customName: string | undefined): void {
        const cTeam = getCatalogTeam.get(originalId) as Row | undefined;
        if (!cTeam) throw new Error(`Catalog team ${originalId} not found`);

        const teamRow: Row = {};
        for (const col of teamCols) teamRow[col] = cTeam[col] ?? null;
        teamRow.league_id = newLeagueId;
        teamRow.origin_team_id = originalId;
        teamRow.logo = String(originalId);
        if (customName && customName.trim()) teamRow.team_name = customName.trim();
        teamRow.played = 0; teamRow.won = 0; teamRow.lost = 0;
        teamRow.sets_won = 0; teamRow.sets_lost = 0; teamRow.points = 0; teamRow.score_diff = 0;
        const newTeamId = Number(insertTeam.run(teamRow).lastInsertRowid);
        teamIdMap.set(originalId, newTeamId);

        // With a fantasy draft, teams start empty — the draft fills rosters.
        // Otherwise each team keeps its original roster.
        if (!draftEnabled) {
            const cPlayers = getCatalogPlayers.all(originalId) as Row[];
            for (const cp of cPlayers) {
                const playerRow: Row = {};
                for (const col of playerCols) playerRow[col] = cp[col] ?? null;
                playerRow.team_id = newTeamId;
                playerRow.matches_played = 0;
                insertPlayer.run(playerRow);
            }
            autoPickLineup(customDb, newTeamId);
        }
    }

    /**
     * Creates a brand-new from-scratch team. When there is no fantasy draft the
     * team also gets a freshly generated roster + starting lineup; with a draft
     * it stays empty and the draft fills it.
     */
    function createCustomTeam(def: CustomTeamDef, newLeagueId: number, country: string): void {
        const teamRow: Row = {};
        for (const col of teamCols) teamRow[col] = null;
        teamRow.team_name = def.name.trim();
        teamRow.league_id = newLeagueId;
        teamRow.country = country;
        teamRow.region = 'north';
        teamRow.logo = def.logo ? String(def.logo) : null;
        teamRow.origin_team_id = null;
        teamRow.stadium = '';
        teamRow.capacity = 0;
        teamRow.founded = '';
        teamRow.team_money = 1000000;
        teamRow.played = 0; teamRow.won = 0; teamRow.lost = 0;
        teamRow.sets_won = 0; teamRow.sets_lost = 0; teamRow.points = 0; teamRow.score_diff = 0;
        const newTeamId = Number(insertTeam.run(teamRow).lastInsertRowid);
        teamIdMap.set(def.id, newTeamId);

        if (!draftEnabled) {
            let jersey = 1;
            for (const [position, count] of Object.entries(DRAFT_QUOTA)) {
                for (let i = 0; i < count; i++) {
                    insertGeneratedStmt.run({
                        ...generatePlayer(position),
                        team_id: newTeamId,
                        jersey_number: jersey++,
                    });
                }
            }
            autoPickLineup(customDb, newTeamId);
        }
    }

    /** Stocks the unassigned (team_id NULL) fantasy-draft player pool. */
    function buildDraftPool(mode: 'existing' | 'generated' | 'mixed'): void {
        const teamCount = teamIdMap.size;
        const quota: Record<string, number> = {
            'Outside Hitter': 2, 'Middle Blocker': 2, 'Opposite Hitter': 1, 'Setter': 1, 'Libero': 1,
        };

        // Real-player candidates from the selected teams, grouped by position.
        const byPosition: Record<string, Row[]> = {};
        if (mode !== 'generated') {
            for (const catalogTeamId of teamIdMap.keys()) {
                if (catalogTeamId < 0) continue; // from-scratch teams have no catalog roster
                for (const p of getCatalogPlayers.all(catalogTeamId) as Row[]) {
                    const pos = String(p.position);
                    (byPosition[pos] ||= []).push(p);
                }
            }
            for (const pos of Object.keys(byPosition)) shuffleRows(byPosition[pos]);
        }

        const insertCopied = (cp: Row): void => {
            const playerRow: Row = {};
            for (const col of playerCols) playerRow[col] = cp[col] ?? null;
            playerRow.team_id = null;
            playerRow.matches_played = 0;
            insertPlayer.run(playerRow);
        };

        for (const [position, perTeam] of Object.entries(quota)) {
            const need = perTeam * teamCount;
            const wantExisting = mode === 'existing' ? need : mode === 'mixed' ? Math.floor(need / 2) : 0;
            const candidates = byPosition[position] ?? [];
            const takeExisting = Math.min(wantExisting, candidates.length);

            for (let i = 0; i < takeExisting; i++) insertCopied(candidates[i]);
            for (let i = 0; i < need - takeExisting; i++) {
                insertGeneratedStmt.run({ ...generatePlayer(position), team_id: null });
            }
        }
    }

    const build = customDb.transaction(() => {
        let linkPriority = 1;

        for (const p of config.pyramids) {
            const country = p.kind === 'international' ? 'International' : (p.country || 'Custom');
            const continent = p.kind === 'international'
                ? 'International'
                : continentForCountry(catalogDb, p.country);

            // Top division = tier 2 (playoff-eligible, matches the classic
            // "premier" tier); feeder = tier 3. proceed-to-playoffs keys on
            // tier 2, and promotion direction is derived from tier numbers.
            const leagueId1 = Number(insertLeague.run(p.tier1Name.trim(), country, 2, continent).lastInsertRowid);
            const leagueId2 = Number(insertLeague.run(p.tier2Name.trim(), country, 3, continent).lastInsertRowid);

            insertConfig.run(leagueId1, JSON.stringify(buildTierConfig(p, 1)));
            insertConfig.run(leagueId2, JSON.stringify(buildTierConfig(p, 2)));

            // bottom R of Tier 1 relegate to Tier 2
            insertLink.run(
                leagueId1, leagueId2,
                JSON.stringify({ scope: 'whole_table', position: 'bottom', count: p.promotionCount }),
                JSON.stringify({ position: 'any' }),
                linkPriority++,
            );
            // top R of Tier 2 promote to Tier 1
            insertLink.run(
                leagueId2, leagueId1,
                JSON.stringify({ scope: 'whole_table', position: 'top', count: p.promotionCount }),
                JSON.stringify({ position: 'any' }),
                linkPriority++,
            );

            // Place each team into its tier: positive ids copy a catalog team,
            // negative ids build a from-scratch custom team.
            const customById = new Map((p.customTeams ?? []).map(c => [c.id, c]));
            const placeTeam = (id: number, leagueId: number): void => {
                if (id < 0) {
                    const def = customById.get(id);
                    if (!def) throw new Error(`Custom team ${id} is missing its definition`);
                    createCustomTeam(def, leagueId, country);
                } else {
                    copyTeam(id, leagueId, asName(p.teamNames?.[String(id)]));
                }
            };
            for (const id of p.tier1TeamIds) placeTeam(id, leagueId1);
            for (const id of p.tier2TeamIds) placeTeam(id, leagueId2);
        }

        // Seasons + fixtures for every league (uses the league_configs written above).
        const leagues = customDb.prepare('SELECT id FROM leagues ORDER BY id').all() as { id: number }[];
        let firstSeasonId: number | null = null;

        for (const lg of leagues) {
            const teamIds = (customDb.prepare('SELECT id FROM teams WHERE league_id = ? ORDER BY id')
                .all(lg.id) as { id: number }[]).map(t => t.id);
            const seasonId = Number(
                insertSeason.run(lg.id, year, `${year} Season`, `${year}-01-01`, `${year}-12-31`).lastInsertRowid
            );
            if (firstSeasonId === null) firstSeasonId = seasonId;

            const slots = generateScheduleForLeague(lg.id, teamIds, year);
            for (const s of slots) {
                insertFixture.run({
                    season_id: seasonId,
                    league_id: lg.id,
                    home_team_id: s.home_team_id,
                    away_team_id: s.away_team_id,
                    game_week: s.game_week,
                    scheduled_date: s.scheduled_date,
                });
            }
        }

        customDb.prepare('INSERT INTO game_state (id, current_date, season_id) VALUES (1, ?, ?)')
            .run(`${year}-01-01`, firstSeasonId);

        // Flag this world as custom so classic systems (national-cup
        // auto-generation) stand down.
        customDb.prepare("INSERT OR REPLACE INTO world_meta (key, value) VALUES ('world_type', 'custom')").run();

        // Fantasy draft: stock the unassigned player pool and flag the save so
        // the draft screen runs before the season starts.
        if (draftEnabled) {
            const poolMode = config.draft?.pool ?? 'existing';
            buildDraftPool(poolMode);
            customDb.prepare("INSERT OR REPLACE INTO world_meta (key, value) VALUES ('draft_status', 'pending')").run();
            customDb.prepare("INSERT OR REPLACE INTO world_meta (key, value) VALUES ('draft_pool_mode', ?)").run(poolMode);
        }

        // Custom cups — knockout tournaments in the Jul–Dec cup block.
        for (const cup of config.cups ?? []) {
            const mappedIds = cup.teamIds
                .map(id => teamIdMap.get(id))
                .filter((x): x is number => x != null);
            if (mappedIds.length !== cup.teamIds.length) continue; // skip if a team is missing
            generateCustomCup(customDb, {
                name: cup.name.trim(),
                teamIds: mappedIds,
                year,
                window: cup.window,
            });
        }
    });

    // generateScheduleForLeague reads via getDb(), so run the build inside the
    // AsyncLocalStorage scope of the custom DB.
    runWithDb(customDb, () => { build(); });
}

function asName(v: number | string | undefined): string | undefined {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s || undefined;
}

function shuffleRows(arr: Row[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
